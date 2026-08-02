/**
 * AI / cost / routing metrics for evaluation runs.
 */
import type { TurnTelemetry, RoutePath } from "@/services/routing/types";

export type ObservedAi = {
  telemetry: TurnTelemetry;
  llmUsed: boolean;
  model?: string | null;
  promptTokens: number;
  completionTokens: number;
  estimatedCostUsd: number;
  knowledgeCardHit: boolean;
  finalResponseLength: number;
};

export type AiMetricResult = {
  llmUsed: boolean;
  cacheHit: boolean;
  knowledgeHit: boolean;
  sqlHit: boolean;
  vectorHit: boolean;
  hybridHit: boolean;
  promptTokens: number;
  completionTokens: number;
  estimatedCostUsd: number;
  latencyMs: number;
  searchLatencyMs: number | null;
  rankLatencyMs: number | null;
  aiLatencyMs: number | null;
  model: string | null;
  primaryRoute: string;
};

function hasRoute(paths: RoutePath[], ...want: RoutePath[]): boolean {
  return want.some((w) => paths.includes(w));
}

export function computeAiMetrics(observed: ObservedAi): AiMetricResult {
  const t = observed.telemetry;
  const stages = t.stageLatencyMs ?? {};
  return {
    llmUsed: observed.llmUsed || t.llmUsed,
    cacheHit: t.cacheHit,
    knowledgeHit:
      observed.knowledgeCardHit ||
      hasRoute(t.routePaths, "knowledge") ||
      t.primaryRoute === "knowledge",
    sqlHit: hasRoute(t.routePaths, "sql") || t.retrievalMode === "sql",
    vectorHit:
      t.retrievalMode === "vector" || t.retrievalMode === "hybrid",
    hybridHit:
      hasRoute(t.routePaths, "hybrid") || t.retrievalMode === "hybrid",
    promptTokens: observed.promptTokens,
    completionTokens: observed.completionTokens,
    estimatedCostUsd: observed.estimatedCostUsd,
    latencyMs: t.latencyMs,
    searchLatencyMs:
      typeof stages.search === "number" ? stages.search : null,
    rankLatencyMs: typeof stages.rank === "number" ? stages.rank : null,
    aiLatencyMs:
      typeof stages.extract === "number" || typeof stages.narrate === "number"
        ? (stages.extract ?? 0) + (stages.narrate ?? 0) + (stages.fitVerify ?? 0)
        : null,
    model: observed.model ?? null,
    primaryRoute: t.primaryRoute,
  };
}

export type AggregateAiMetrics = {
  totalQuestions: number;
  llmUsageRate: number;
  avgPromptTokens: number;
  avgCompletionTokens: number;
  avgCostUsd: number;
  costPerQuestion: number;
  questionsAvoidingLlm: number;
  smallModelCount: number;
  largeModelCount: number;
  knowledgeCardHitRate: number;
  cacheHitRate: number;
  sqlHitRate: number;
  vectorHitRate: number;
  hybridHitRate: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  avgSearchLatencyMs: number | null;
  avgRankLatencyMs: number | null;
  avgAiLatencyMs: number | null;
};

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
  );
  return sorted[idx]!;
}

function isSmallModel(model: string | null): boolean {
  if (!model) return false;
  return /mini|nano|small/i.test(model);
}

function isLargeModel(model: string | null): boolean {
  if (!model) return false;
  return /gpt-4\.1(?!-mini)|gpt-4o(?!-mini)|opus|sonnet/i.test(model);
}

export function aggregateAiMetrics(
  rows: AiMetricResult[],
): AggregateAiMetrics {
  const n = rows.length || 1;
  const latencies = rows
    .map((r) => r.latencyMs)
    .filter((x) => x > 0)
    .sort((a, b) => a - b);

  const avg = (pick: (r: AiMetricResult) => number | null) => {
    const vals = rows
      .map(pick)
      .filter((x): x is number => typeof x === "number");
    if (vals.length === 0) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  };

  const totalCost = rows.reduce((s, r) => s + r.estimatedCostUsd, 0);

  return {
    totalQuestions: rows.length,
    llmUsageRate: rows.filter((r) => r.llmUsed).length / n,
    avgPromptTokens: rows.reduce((s, r) => s + r.promptTokens, 0) / n,
    avgCompletionTokens:
      rows.reduce((s, r) => s + r.completionTokens, 0) / n,
    avgCostUsd: totalCost / n,
    costPerQuestion: totalCost / n,
    questionsAvoidingLlm: rows.filter((r) => !r.llmUsed).length,
    smallModelCount: rows.filter((r) => isSmallModel(r.model)).length,
    largeModelCount: rows.filter((r) => isLargeModel(r.model)).length,
    knowledgeCardHitRate: rows.filter((r) => r.knowledgeHit).length / n,
    cacheHitRate: rows.filter((r) => r.cacheHit).length / n,
    sqlHitRate: rows.filter((r) => r.sqlHit).length / n,
    vectorHitRate: rows.filter((r) => r.vectorHit).length / n,
    hybridHitRate: rows.filter((r) => r.hybridHit).length / n,
    avgLatencyMs: latencies.length
      ? latencies.reduce((a, b) => a + b, 0) / latencies.length
      : 0,
    p50LatencyMs: percentile(latencies, 50),
    p95LatencyMs: percentile(latencies, 95),
    avgSearchLatencyMs: avg((r) => r.searchLatencyMs),
    avgRankLatencyMs: avg((r) => r.rankLatencyMs),
    avgAiLatencyMs: avg((r) => r.aiLatencyMs),
  };
}
