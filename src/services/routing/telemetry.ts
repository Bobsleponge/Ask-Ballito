import "server-only";
import { captureServerEvent } from "@/lib/analytics/posthog-server";
import type { TurnTelemetry } from "./types";
import { primaryRouteFromPaths } from "./types";

/**
 * Emit a single turn-level routing event for dashboards.
 * Never throws — observability must not break chat.
 */
export function captureTurnRouting(opts: {
  userId?: string | null;
  citySlug: string;
  telemetry: TurnTelemetry;
}): void {
  const t = opts.telemetry;
  const primary = t.primaryRoute || primaryRouteFromPaths(t.routePaths);

  captureServerEvent({
    distinctId: opts.userId ?? "anonymous",
    event: "intelligence_turn",
    properties: {
      city: opts.citySlug,
      query_class: t.queryClass,
      classifier_confidence: t.classifierConfidence,
      classifier_signals: t.classifierSignals,
      route_paths: t.routePaths,
      primary_route: primary,
      llm_used: t.llmUsed,
      llm_extract: t.llmStages.extract,
      llm_narrate: t.llmStages.narrate,
      llm_fit_verify: t.llmStages.fitVerify,
      cache_hit: t.cacheHit,
      retrieval_mode: t.retrievalMode,
      candidate_count: t.candidateCount,
      extractor_skipped: t.extractorSkipped,
      narration_skipped: t.narrationSkipped,
      latency_ms: t.latencyMs,
      stage_latency_ms: t.stageLatencyMs,
      knowledge_resolved: t.knowledgeResolved,
      knowledge_resolution_type: t.knowledgeResolutionType,
      knowledge_resolver_plugin: t.knowledgeResolverPlugin,
    },
  });
}

export function telemetryToLogFields(t: TurnTelemetry) {
  return {
    queryClass: t.queryClass,
    classifierConfidence: t.classifierConfidence,
    classifierSignals: t.classifierSignals,
    routePaths: t.routePaths,
    primaryRoute: t.primaryRoute || primaryRouteFromPaths(t.routePaths),
    llmUsed: t.llmUsed,
    llmStages: t.llmStages,
    cacheHit: t.cacheHit,
    retrievalMode: t.retrievalMode,
    candidateCount: t.candidateCount,
    extractorSkipped: t.extractorSkipped,
    narrationSkipped: t.narrationSkipped,
    stageLatencyMs: t.stageLatencyMs,
    knowledgeResolved: t.knowledgeResolved,
    knowledgeResolutionType: t.knowledgeResolutionType,
    knowledgeResolverPlugin: t.knowledgeResolverPlugin,
  };
}
