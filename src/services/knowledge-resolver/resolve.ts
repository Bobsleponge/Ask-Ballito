import "server-only";
import { KNOWLEDGE_RESOLVER_PLUGINS } from "./registry";
import {
  KNOWLEDGE_RESOLVER_CONFIDENCE_THRESHOLD,
  type KnowledgeResolution,
  type KnowledgeResolverInput,
} from "./types";

function searchFallback(
  hints: Pick<KnowledgeResolution, "draftQueries" | "signals">,
): KnowledgeResolution {
  return {
    type: "SEARCH",
    answered: false,
    confidence: 0,
    reason: "No structured knowledge matched; delegate to search",
    sources: [],
    nextStage: "search",
    expectedCost: "none",
    expectedLatencyMs: 0,
    pluginId: "none",
    draftQueries: hints.draftQueries,
    signals: hints.signals,
  };
}

/**
 * Deterministic knowledge resolution: try plugins in registry order.
 * First answered resolution ≥ confidence threshold wins.
 * Non-answer hints (e.g. knowledge-card seed queries) are merged into the SEARCH fallback.
 */
export async function resolveKnowledge(
  input: KnowledgeResolverInput,
): Promise<KnowledgeResolution> {
  const draftQueries: string[] = [];
  const signals: string[] = [];

  for (const plugin of KNOWLEDGE_RESOLVER_PLUGINS) {
    const result = await plugin.resolve(input);
    if (!result) continue;

    if (result.signals?.length) signals.push(...result.signals);
    if (result.draftQueries?.length) draftQueries.push(...result.draftQueries);

    if (
      result.answered &&
      result.confidence >= KNOWLEDGE_RESOLVER_CONFIDENCE_THRESHOLD
    ) {
      return result;
    }
  }

  return searchFallback({
    draftQueries: draftQueries.length > 0 ? draftQueries : undefined,
    signals: signals.length > 0 ? signals : undefined,
  });
}
