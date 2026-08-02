import { NextResponse, type NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { chatRequestSchema } from "@/lib/schemas/chat";
import { getCity } from "@/config/cities";
import {
  checkAnonymousChatQuota,
  checkChatRateLimit,
  checkGlobalChatQuota,
  checkUserDailyChatQuota,
  checkUserMonthlyChatQuota,
  checkUserNewAccountChatQuota,
  getClientIp,
  isRateLimitConfigured,
  USER_CHAT_NEW_ACCOUNT_HOURS,
} from "@/lib/security/rate-limit";
import { captureAbuseEvent } from "@/lib/security/abuse-events";
import { maybeEmitAiBudgetAlerts } from "@/lib/security/ai-budget-alerts";
import {
  isUpstreamAiError,
  upstreamAiUserMessage,
} from "@/lib/ai/upstream-errors";
import { conversationService } from "@/services/ai/conversation.service";
import { getCurrentUser } from "@/lib/auth/user";
import { getCurrentProfile } from "@/lib/auth/require-admin";
import { env } from "@/lib/env";
import { recordSearchEvent } from "@/lib/discover/record-search-event";

export const runtime = "nodejs";
export const maxDuration = 60;

function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function failClosed503() {
  return NextResponse.json(
    { error: "Service temporarily unavailable." },
    { status: 503 },
  );
}

export async function POST(request: NextRequest) {
  // 1. Production requires Upstash — fail closed when missing.
  if (env.NODE_ENV === "production" && !isRateLimitConfigured()) {
    return failClosed503();
  }

  const ip = getClientIp(request);
  const user = await getCurrentUser();

  if (user) {
    const profile = await getCurrentProfile();
    if (profile?.abuse_suspended) {
      captureAbuseEvent({
        event: "abuse_suspended",
        distinctId: user.id,
        properties: { route: "api/chat" },
      });
      return NextResponse.json(
        {
          error: "Your account is temporarily restricted from chat.",
          code: "abuse_suspended",
        },
        { status: 403 },
      );
    }
  }

  // 2. Burst rate limit first (so a 429 does not burn daily / global quotas).
  const rl = await checkChatRateLimit(user ? `user:${user.id}` : `ip:${ip}`);
  if (!rl.configured && env.NODE_ENV === "production") {
    return failClosed503();
  }
  if (!rl.success) {
    captureAbuseEvent({
      event: "rate_limited",
      distinctId: user?.id ?? ip,
      properties: { route: "api/chat", scope: "burst" },
    });
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429 },
    );
  }

  // 3. App-wide daily ceiling (org OpenAI spend backstop).
  const global = await checkGlobalChatQuota();
  if (!global.configured && env.NODE_ENV === "production") {
    return failClosed503();
  }
  if (!global.success) {
    captureAbuseEvent({
      event: "global_chat_cap",
      distinctId: user?.id ?? ip,
      properties: { route: "api/chat" },
    });
    return NextResponse.json(
      {
        error:
          "The concierge is at capacity for today. Please try again tomorrow.",
        code: "global_cap",
      },
      { status: 503 },
    );
  }
  maybeEmitAiBudgetAlerts(global, user?.id ?? ip);

  // 4. Hybrid gate: anonymous users get a small daily allowance, then must sign in.
  if (!user) {
    const anon = await checkAnonymousChatQuota(ip);
    if (!anon.configured && env.NODE_ENV === "production") {
      return failClosed503();
    }
    if (!anon.success) {
      captureAbuseEvent({
        event: "anon_quota_exhausted",
        distinctId: ip,
        properties: { route: "api/chat" },
      });
      captureAbuseEvent({
        event: "auth_required",
        distinctId: ip,
        properties: { route: "api/chat" },
      });
      return NextResponse.json(
        {
          error: "Sign in to continue chatting.",
          code: "auth_required",
        },
        { status: 401 },
      );
    }
  } else {
    // Signed-in daily spend cap (weighted for multi-call turns).
    const daily = await checkUserDailyChatQuota(user.id);
    if (!daily.configured && env.NODE_ENV === "production") {
      return failClosed503();
    }
    if (!daily.success) {
      captureAbuseEvent({
        event: "user_daily_cap",
        distinctId: user.id,
        properties: { route: "api/chat" },
      });
      return NextResponse.json(
        {
          error:
            "You've reached today's chat limit. Please try again tomorrow.",
          code: "daily_cap",
        },
        { status: 429 },
      );
    }

    const monthly = await checkUserMonthlyChatQuota(user.id);
    if (!monthly.configured && env.NODE_ENV === "production") {
      return failClosed503();
    }
    if (!monthly.success) {
      captureAbuseEvent({
        event: "user_monthly_cap",
        distinctId: user.id,
        properties: { route: "api/chat" },
      });
      return NextResponse.json(
        {
          error:
            "You've reached this month's chat limit. Please try again later.",
          code: "monthly_cap",
        },
        { status: 429 },
      );
    }

    const createdAt = user.created_at
      ? new Date(user.created_at).getTime()
      : 0;
    const ageMs = Date.now() - createdAt;
    if (
      createdAt > 0 &&
      ageMs < USER_CHAT_NEW_ACCOUNT_HOURS * 60 * 60 * 1000
    ) {
      const ramp = await checkUserNewAccountChatQuota(user.id);
      if (!ramp.configured && env.NODE_ENV === "production") {
        return failClosed503();
      }
      if (!ramp.success) {
        captureAbuseEvent({
          event: "user_new_account_cap",
          distinctId: user.id,
          properties: { route: "api/chat" },
        });
        return NextResponse.json(
          {
            error:
              "New accounts have a temporary chat limit. Please try again tomorrow.",
            code: "new_account_cap",
          },
          { status: 429 },
        );
      }
    }
  }

  // 5. Validate input.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const city = getCity(parsed.data.city);
  if (!city || !city.enabled) {
    return NextResponse.json(
      { error: `City "${parsed.data.city}" is not available.` },
      { status: 400 },
    );
  }

  // 6. Run the concierge turn and stream the response as SSE.
  try {
    // Best-effort trending feed (non-blocking).
    void recordSearchEvent({
      citySlug: city.slug,
      query: parsed.data.message,
      userId: user?.id ?? null,
      source: "chat",
    });

    const {
      businesses,
      composition,
      plan,
      workflowId,
      llmInvoked,
      clarification,
      stream,
      telemetry,
      queryTrace,
    } = await conversationService.handle({
      city,
      message: parsed.data.message,
      history: parsed.data.history,
      userId: user?.id ?? null,
      conversationId: parsed.data.conversationId ?? null,
      excludeBusinessIds: parsed.data.excludeBusinessIds,
      retry: parsed.data.retry,
    });

    const encoder = new TextEncoder();
    const isProd = env.NODE_ENV === "production";
    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        const meta: Record<string, unknown> = {
          businesses,
          composition: {
            strategy: composition.strategy,
            title: composition.title,
            sections: composition.sections,
            grounding: composition.grounding,
          },
          workflow: workflowId,
          llmInvoked,
          clarification,
          routing: {
            queryClass: telemetry.queryClass,
            primaryRoute: telemetry.primaryRoute,
            cacheHit: telemetry.cacheHit,
            llmUsed: telemetry.llmUsed,
            extractorSkipped: telemetry.extractorSkipped,
            narrationSkipped: telemetry.narrationSkipped,
            retrievalMode: telemetry.retrievalMode,
          },
        };

        // Trim planner internals in production (reduce attack-surface / info leak).
        if (!isProd) {
          meta.plan = {
            intent: plan.intent,
            goal: plan.goal,
            workflow: plan.workflow,
            needsClarification: plan.needsClarification,
            responseMode: plan.responseMode,
            llmRequired: plan.llmRequired,
            executionSteps: plan.executionPlan.map((s) => s.id),
            locationRef: plan.locationRef?.label ?? null,
            compositionStrategy: plan.composition.strategy,
          };
          if (queryTrace) meta.queryTrace = queryTrace;
        } else {
          meta.plan = {
            workflow: plan.workflow,
            needsClarification: plan.needsClarification,
            responseMode: plan.responseMode,
            compositionStrategy: plan.composition.strategy,
          };
        }

        controller.enqueue(encoder.encode(sse("meta", meta)));

        try {
          for await (const delta of stream) {
            controller.enqueue(encoder.encode(sse("delta", { text: delta })));
          }
          controller.enqueue(encoder.encode(sse("done", {})));
        } catch (err) {
          Sentry.captureException(err, { tags: { route: "api/chat" } });
          const upstream = isUpstreamAiError(err);
          if (upstream) {
            captureAbuseEvent({
              event: "upstream_ai_unavailable",
              distinctId: user?.id ?? ip,
              properties: { route: "api/chat", scope: "stream" },
            });
          }
          controller.enqueue(
            encoder.encode(
              sse("error", {
                message: upstream
                  ? upstreamAiUserMessage()
                  : "The concierge ran into a problem generating a response.",
                code: upstream ? "upstream_unavailable" : "stream_error",
              }),
            ),
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { route: "api/chat" } });
    if (isUpstreamAiError(err)) {
      captureAbuseEvent({
        event: "upstream_ai_unavailable",
        distinctId: user?.id ?? ip,
        properties: { route: "api/chat", scope: "pre_stream" },
      });
      return NextResponse.json(
        {
          error: upstreamAiUserMessage(),
          code: "upstream_unavailable",
        },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: "Failed to process your request." },
      { status: 500 },
    );
  }
}
