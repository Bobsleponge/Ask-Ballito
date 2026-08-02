/**
 * Persist and load evaluation runs via Supabase service role.
 */
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

export type EvalRunInsert = {
  environment?: string;
  gitSha?: string | null;
  rankConfigVersion?: string | null;
  notes?: string | null;
};

export type EvalResultInsert = {
  questionId: string;
  query: string;
  intentExpected?: string | null;
  intentDetected?: string | null;
  passIntent?: boolean | null;
  passTop1?: boolean | null;
  passTop3?: boolean | null;
  passTop5?: boolean | null;
  metrics: Record<string, unknown>;
  suggestions: unknown[];
};

export async function createEvalRun(input: EvalRunInsert): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("eval_runs")
    .insert({
      environment: input.environment ?? "staging",
      git_sha: input.gitSha ?? null,
      rank_config_version: input.rankConfigVersion ?? null,
      notes: input.notes ?? null,
      summary: {} as Json,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`Failed to create eval_run: ${error?.message ?? "unknown"}`);
  }
  return data.id;
}

export async function finalizeEvalRun(params: {
  runId: string;
  questionCount: number;
  summary: Record<string, unknown>;
}): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("eval_runs")
    .update({
      finished_at: new Date().toISOString(),
      question_count: params.questionCount,
      summary: params.summary as Json,
    })
    .eq("id", params.runId);

  if (error) {
    throw new Error(`Failed to finalize eval_run: ${error.message}`);
  }
}

export async function insertEvalResults(
  runId: string,
  results: EvalResultInsert[],
): Promise<void> {
  if (results.length === 0) return;
  const admin = createAdminClient();
  const chunkSize = 100;
  for (let i = 0; i < results.length; i += chunkSize) {
    const chunk = results.slice(i, i + chunkSize).map((r) => ({
      run_id: runId,
      question_id: r.questionId,
      query: r.query,
      intent_expected: r.intentExpected ?? null,
      intent_detected: r.intentDetected ?? null,
      pass_intent: r.passIntent ?? null,
      pass_top1: r.passTop1 ?? null,
      pass_top3: r.passTop3 ?? null,
      pass_top5: r.passTop5 ?? null,
      metrics: r.metrics as Json,
      suggestions: r.suggestions as Json,
    }));
    const { error } = await admin.from("eval_results").insert(chunk);
    if (error) {
      throw new Error(`Failed to insert eval_results: ${error.message}`);
    }
  }
}

export async function loadEvalRun(runId: string) {
  const admin = createAdminClient();
  const { data: run, error } = await admin
    .from("eval_runs")
    .select("*")
    .eq("id", runId)
    .maybeSingle();
  if (error || !run) {
    throw new Error(`eval_run not found: ${runId}`);
  }
  const { data: results, error: rErr } = await admin
    .from("eval_results")
    .select("*")
    .eq("run_id", runId)
    .order("question_id");
  if (rErr) {
    throw new Error(rErr.message);
  }
  return { run, results: results ?? [] };
}

export async function loadLatestEvalRuns(limit = 2) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("eval_runs")
    .select("*")
    .not("finished_at", "is", null)
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) {
    throw new Error(error.message);
  }
  return data ?? [];
}
