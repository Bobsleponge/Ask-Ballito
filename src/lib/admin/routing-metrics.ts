import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { estimateCostUsd } from "@/config/ai-pricing";
import { requireAdmin } from "@/lib/auth/require-admin";
import type { QueryClass, RoutePath } from "@/services/routing/types";

export type RoutingMetrics = {
  totalTurns: number;
  cacheHitRate: number;
  knowledgeRate: number;
  knowledgeResolutionRate: number;
  searchResolutionRate: number;
  factResolutionRate: number;
  sqlOrHybridRate: number;
  llmUsageRate: number;
  extractRate: number;
  narrateRate: number;
  avgLatencyMs: number;
  avgKnowledgeResolverMs: number;
  totalEstimatedCostUsd: number;
  costPerRequest: number;
  routeDistribution: Record<string, number>;
  queryClassDistribution: Record<string, number>;
};

type RoutingBlob = {
  primaryRoute?: RoutePath | string;
  routePaths?: string[];
  cacheHit?: boolean;
  llmUsed?: boolean;
  llmStages?: { extract?: boolean; narrate?: boolean; fitVerify?: boolean };
  queryClass?: QueryClass | string | null;
  latencyMs?: number;
  knowledgeResolved?: boolean;
  knowledgeResolutionType?: string | null;
  stageLatencyMs?: Record<string, number>;
};

function asRouting(output: unknown): RoutingBlob | null {
  if (!output || typeof output !== "object") return null;
  const o = output as Record<string, unknown>;
  const routing = o.routing;
  if (!routing || typeof routing !== "object") return null;
  return routing as RoutingBlob;
}

/** Aggregate ConversationOrchestrator routing telemetry from ai_logs (7d). */
export async function loadRoutingMetrics(): Promise<RoutingMetrics> {
  await requireAdmin();
  const admin = createAdminClient();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: logs, error } = await admin
    .from("ai_logs")
    .select(
      "service, output, latency_ms, estimated_cost_usd, model, input_tokens, output_tokens",
    )
    .eq("service", "ConversationOrchestrator")
    .gte("created_at", since)
    .limit(5000);

  if (error || !logs) {
    return emptyMetrics();
  }

  let cacheHits = 0;
  let knowledge = 0;
  let knowledgeResolved = 0;
  let searchResolved = 0;
  let factResolved = 0;
  let sqlHybrid = 0;
  let llmUsed = 0;
  let extract = 0;
  let narrate = 0;
  let latencySum = 0;
  let latencyN = 0;
  let resolverLatencySum = 0;
  let resolverLatencyN = 0;
  let costSum = 0;
  const routes: Record<string, number> = {};
  const classes: Record<string, number> = {};

  for (const row of logs) {
    const routing = asRouting(row.output);
    const cost =
      row.estimated_cost_usd ??
      estimateCostUsd({
        model: row.model,
        inputTokens: row.input_tokens,
        outputTokens: row.output_tokens,
      }) ??
      0;
    costSum += cost;

    if (!routing) continue;

    const primary = routing.primaryRoute ?? "unknown";
    routes[primary] = (routes[primary] ?? 0) + 1;

    if (routing.queryClass) {
      const qc = String(routing.queryClass);
      classes[qc] = (classes[qc] ?? 0) + 1;
    }

    if (routing.cacheHit) cacheHits += 1;
    if (primary === "knowledge" || routing.routePaths?.includes("knowledge")) {
      knowledge += 1;
    }
    if (routing.knowledgeResolved) {
      knowledgeResolved += 1;
    } else if (!routing.cacheHit) {
      searchResolved += 1;
    }
    if (
      routing.knowledgeResolutionType === "FACT" ||
      routing.knowledgeResolutionType === "SQL"
    ) {
      factResolved += 1;
    }
    if (
      primary === "hybrid" ||
      primary === "sql" ||
      routing.routePaths?.includes("hybrid") ||
      routing.routePaths?.includes("sql")
    ) {
      sqlHybrid += 1;
    }
    if (routing.llmUsed) llmUsed += 1;
    if (routing.llmStages?.extract) extract += 1;
    if (routing.llmStages?.narrate) narrate += 1;

    const lat = routing.latencyMs ?? row.latency_ms;
    if (typeof lat === "number" && lat > 0) {
      latencySum += lat;
      latencyN += 1;
    }
    const resolverMs = routing.stageLatencyMs?.knowledge_resolver;
    if (typeof resolverMs === "number" && resolverMs >= 0) {
      resolverLatencySum += resolverMs;
      resolverLatencyN += 1;
    }
  }

  const total = logs.length || 1;
  const turnsWithRouting = Object.values(routes).reduce((a, b) => a + b, 0) || 1;

  return {
    totalTurns: logs.length,
    cacheHitRate: cacheHits / turnsWithRouting,
    knowledgeRate: knowledge / turnsWithRouting,
    knowledgeResolutionRate: knowledgeResolved / turnsWithRouting,
    searchResolutionRate: searchResolved / turnsWithRouting,
    factResolutionRate: factResolved / turnsWithRouting,
    sqlOrHybridRate: sqlHybrid / turnsWithRouting,
    llmUsageRate: llmUsed / turnsWithRouting,
    extractRate: extract / turnsWithRouting,
    narrateRate: narrate / turnsWithRouting,
    avgLatencyMs: latencyN > 0 ? latencySum / latencyN : 0,
    avgKnowledgeResolverMs:
      resolverLatencyN > 0 ? resolverLatencySum / resolverLatencyN : 0,
    totalEstimatedCostUsd: costSum,
    costPerRequest: costSum / total,
    routeDistribution: routes,
    queryClassDistribution: classes,
  };
}

function emptyMetrics(): RoutingMetrics {
  return {
    totalTurns: 0,
    cacheHitRate: 0,
    knowledgeRate: 0,
    knowledgeResolutionRate: 0,
    searchResolutionRate: 0,
    factResolutionRate: 0,
    sqlOrHybridRate: 0,
    llmUsageRate: 0,
    extractRate: 0,
    narrateRate: 0,
    avgLatencyMs: 0,
    avgKnowledgeResolverMs: 0,
    totalEstimatedCostUsd: 0,
    costPerRequest: 0,
    routeDistribution: {},
    queryClassDistribution: {},
  };
}
