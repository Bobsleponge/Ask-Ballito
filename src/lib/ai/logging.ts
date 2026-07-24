import "server-only";
import * as Sentry from "@sentry/nextjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { captureServerEvent } from "@/lib/analytics/posthog-server";
import { estimateCostUsd } from "@/config/ai-pricing";
import type { AiLogInsert } from "@/types/database";

export interface AiCallLog {
  service: string;
  promptVersion?: string | null;
  model?: string | null;
  input?: unknown;
  output?: unknown;
  inputTokens?: number | null;
  outputTokens?: number | null;
  latencyMs?: number | null;
  status?: "success" | "error";
  error?: string | null;
  userId?: string | null;
  conversationId?: string | null;
}

/**
 * Persist a record of every AI call to ai_logs, and mirror failures to Sentry
 * and a PostHog server event. Never throws -- logging must not break requests.
 *
 * Retention: rows may contain user message text / planner I/O (PII). Keep for
 * ~90 days for abuse debugging, then delete or anonymize (see README Security).
 */
export async function logAiCall(log: AiCallLog): Promise<void> {
  const estimatedCostUsd = estimateCostUsd({
    model: log.model,
    inputTokens: log.inputTokens,
    outputTokens: log.outputTokens,
  });

  const row: AiLogInsert = {
    service: log.service,
    prompt_version: log.promptVersion ?? null,
    model: log.model ?? null,
    input: (log.input ?? {}) as AiLogInsert["input"],
    output: (log.output ?? {}) as AiLogInsert["output"],
    input_tokens: log.inputTokens ?? null,
    output_tokens: log.outputTokens ?? null,
    estimated_cost_usd: estimatedCostUsd,
    latency_ms: log.latencyMs ?? null,
    status: log.status ?? "success",
    error: log.error ?? null,
    user_id: log.userId ?? null,
    conversation_id: log.conversationId ?? null,
  };

  try {
    const admin = createAdminClient();
    await admin.from("ai_logs").insert(row);
  } catch (err) {
    Sentry.captureException(err, { tags: { area: "ai_logging" } });
  }

  if (log.status === "error" && log.error) {
    Sentry.captureMessage(`AI call failed: ${log.service}`, {
      level: "error",
      extra: { error: log.error, service: log.service },
    });
  }

  captureServerEvent({
    distinctId: log.userId ?? "anonymous",
    event: log.status === "error" ? "ai_call_failed" : "ai_call_succeeded",
    properties: {
      service: log.service,
      model: log.model,
      latency_ms: log.latencyMs,
      prompt_version: log.promptVersion,
      estimated_cost_usd: estimatedCostUsd,
      input_tokens: log.inputTokens,
      output_tokens: log.outputTokens,
    },
  });
}

/**
 * Convenience wrapper that times an async AI operation and logs the outcome.
 */
export async function withAiLogging<T>(
  base: Omit<AiCallLog, "latencyMs" | "status" | "error" | "output">,
  fn: () => Promise<{ result: T; output?: unknown; inputTokens?: number; outputTokens?: number }>,
): Promise<T> {
  const start = Date.now();
  try {
    const { result, output, inputTokens, outputTokens } = await fn();
    await logAiCall({
      ...base,
      output,
      inputTokens,
      outputTokens,
      latencyMs: Date.now() - start,
      status: "success",
    });
    return result;
  } catch (err) {
    await logAiCall({
      ...base,
      latencyMs: Date.now() - start,
      status: "error",
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
