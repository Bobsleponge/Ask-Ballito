"use server";

import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { estimateCostUsd } from "@/config/ai-pricing";
import { revalidatePath } from "next/cache";

export type ActionResult = { ok: true } | { ok: false; error: string };

const setAbuseSchema = z.object({
  userId: z.string().uuid(),
  suspended: z.boolean(),
});

export async function setAbuseSuspendedAction(input: {
  userId: string;
  suspended: boolean;
}): Promise<ActionResult> {
  try {
    await requireAdmin();
    const parsed = setAbuseSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "Invalid request" };
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from("profiles")
      .update({ abuse_suspended: parsed.data.suspended })
      .eq("id", parsed.data.userId);

    if (error) {
      return { ok: false, error: error.message };
    }

    revalidatePath("/admin/ai-usage");
    return { ok: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update suspension";
    return { ok: false, error: message };
  }
}

export type AiUsageRow = {
  userId: string;
  email: string | null;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  abuseSuspended: boolean;
};

/** Top users by estimated AI cost in the last 7 days. */
export async function loadTopAiUsage(limit = 25): Promise<{
  rows: AiUsageRow[];
  totalEstimatedCostUsd: number;
  totalCalls: number;
}> {
  await requireAdmin();
  const admin = createAdminClient();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: logs, error } = await admin
    .from("ai_logs")
    .select(
      "user_id, model, input_tokens, output_tokens, estimated_cost_usd",
    )
    .gte("created_at", since)
    .not("user_id", "is", null)
    .limit(8000);

  if (error || !logs) {
    return { rows: [], totalEstimatedCostUsd: 0, totalCalls: 0 };
  }

  type Acc = {
    calls: number;
    inputTokens: number;
    outputTokens: number;
    estimatedCostUsd: number;
  };
  const counts = new Map<string, Acc>();
  let totalEstimatedCostUsd = 0;
  let totalCalls = 0;

  for (const row of logs) {
    if (!row.user_id) continue;
    const cost =
      row.estimated_cost_usd ??
      estimateCostUsd({
        model: row.model,
        inputTokens: row.input_tokens,
        outputTokens: row.output_tokens,
      }) ??
      0;
    totalEstimatedCostUsd += cost;
    totalCalls += 1;
    const existing = counts.get(row.user_id) ?? {
      calls: 0,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUsd: 0,
    };
    existing.calls += 1;
    existing.inputTokens += row.input_tokens ?? 0;
    existing.outputTokens += row.output_tokens ?? 0;
    existing.estimatedCostUsd += cost;
    counts.set(row.user_id, existing);
  }

  const ranked = [...counts.entries()]
    .sort((a, b) => b[1].estimatedCostUsd - a[1].estimatedCostUsd)
    .slice(0, limit);

  if (ranked.length === 0) {
    return { rows: [], totalEstimatedCostUsd, totalCalls };
  }

  const ids = ranked.map(([id]) => id);
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, email, abuse_suspended")
    .in("id", ids);

  const byId = new Map(
    (profiles ?? []).map((p) => [
      p.id,
      { email: p.email, abuseSuspended: p.abuse_suspended },
    ]),
  );

  return {
    totalEstimatedCostUsd,
    totalCalls,
    rows: ranked.map(([userId, stats]) => ({
      userId,
      email: byId.get(userId)?.email ?? null,
      calls: stats.calls,
      inputTokens: stats.inputTokens,
      outputTokens: stats.outputTokens,
      estimatedCostUsd: stats.estimatedCostUsd,
      abuseSuspended: byId.get(userId)?.abuseSuspended ?? false,
    })),
  };
}
