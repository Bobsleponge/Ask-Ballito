/**
 * Cost-aware routing telemetry for the intelligence layer.
 * Route paths are ordered cheapest → most expensive for reporting.
 */

import type { ResolutionType } from "@/services/knowledge-resolver/types";

export type QueryClass =
  | "FACT"
  | "BUSINESS_SEARCH"
  | "EVENT_SEARCH"
  | "PLACE_SEARCH"
  | "DISCOVERY"
  | "COMPARISON"
  | "PLANNING"
  | "LIVE_INFORMATION"
  | "CONVERSATION";

export type RoutePath =
  | "cache"
  | "knowledge"
  | "sql"
  | "hybrid"
  | "capability"
  | "llm_extract"
  | "llm_narrate"
  | "llm_fit_verify";

export type RetrievalMode = "none" | "vector" | "lexical" | "hybrid" | "sql" | "knowledge";

export interface LlmStagesUsed {
  extract: boolean;
  narrate: boolean;
  fitVerify: boolean;
}

export interface TurnTelemetry {
  queryClass: QueryClass | null;
  classifierConfidence: number | null;
  classifierSignals: string[];
  routePaths: RoutePath[];
  primaryRoute: RoutePath;
  llmUsed: boolean;
  llmStages: LlmStagesUsed;
  cacheHit: boolean;
  retrievalMode: RetrievalMode;
  candidateCount: number;
  extractorSkipped: boolean;
  narrationSkipped: boolean;
  latencyMs: number;
  stageLatencyMs: Record<string, number>;
  /** Knowledge Resolver outcome (when KNOWLEDGE_RESOLVER is on). */
  knowledgeResolved: boolean;
  knowledgeResolutionType: ResolutionType | null;
  knowledgeResolverPlugin: string | null;
}

export function emptyLlmStages(): LlmStagesUsed {
  return { extract: false, narrate: false, fitVerify: false };
}

export function primaryRouteFromPaths(paths: RoutePath[]): RoutePath {
  const order: RoutePath[] = [
    "cache",
    "knowledge",
    "sql",
    "hybrid",
    "capability",
    "llm_extract",
    "llm_fit_verify",
    "llm_narrate",
  ];
  for (const p of order) {
    if (paths.includes(p)) return p;
  }
  return paths[0] ?? "hybrid";
}

export function createTurnTelemetry(
  partial?: Partial<TurnTelemetry>,
): TurnTelemetry {
  return {
    queryClass: null,
    classifierConfidence: null,
    classifierSignals: [],
    routePaths: [],
    primaryRoute: "hybrid",
    llmUsed: false,
    llmStages: emptyLlmStages(),
    cacheHit: false,
    retrievalMode: "none",
    candidateCount: 0,
    extractorSkipped: false,
    narrationSkipped: false,
    latencyMs: 0,
    stageLatencyMs: {},
    knowledgeResolved: false,
    knowledgeResolutionType: null,
    knowledgeResolverPlugin: null,
    ...partial,
  };
}
