import { NextResponse, type NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { chatRequestSchema } from "@/lib/schemas/chat";
import { getCity } from "@/config/cities";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { conversationService } from "@/services/ai/conversation.service";
import { getCurrentUser } from "@/lib/auth/user";

export const runtime = "nodejs";
export const maxDuration = 60;

function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: NextRequest) {
  // 1. Rate limit (abuse protection).
  const ip = getClientIp(request);
  const rl = await checkRateLimit(`chat:${ip}`);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429 },
    );
  }

  // 2. Validate input.
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

  // 3. Identify user (optional; conversations work anonymously too).
  const user = await getCurrentUser();

  // 4. Run the concierge turn and stream the response as SSE.
  try {
    const {
      businesses,
      composition,
      plan,
      workflowId,
      llmInvoked,
      clarification,
      stream,
    } = await conversationService.handle({
      city,
      message: parsed.data.message,
      history: parsed.data.history,
      userId: user?.id ?? null,
      conversationId: parsed.data.conversationId ?? null,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        controller.enqueue(
          encoder.encode(
            sse("meta", {
              businesses,
              composition: {
                strategy: composition.strategy,
                title: composition.title,
                sections: composition.sections,
              },
              plan: {
                intent: plan.intent,
                goal: plan.goal,
                workflow: plan.workflow,
                needsClarification: plan.needsClarification,
                responseMode: plan.responseMode,
                llmRequired: plan.llmRequired,
                executionSteps: plan.executionPlan.map((s) => s.id),
                locationRef: plan.locationRef?.label ?? null,
                compositionStrategy: plan.composition.strategy,
              },
              workflow: workflowId,
              llmInvoked,
              clarification,
            }),
          ),
        );

        try {
          for await (const delta of stream) {
            controller.enqueue(encoder.encode(sse("delta", { text: delta })));
          }
          controller.enqueue(encoder.encode(sse("done", {})));
        } catch (err) {
          Sentry.captureException(err, { tags: { route: "api/chat" } });
          controller.enqueue(
            encoder.encode(
              sse("error", {
                message:
                  "The concierge ran into a problem generating a response.",
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
    return NextResponse.json(
      { error: "Failed to process your request." },
      { status: 500 },
    );
  }
}
