/**
 * Rule-based improvement suggestions from eval failures.
 */
import type { GoldQuestion } from "./types";
import type { SearchMetricResult } from "./search-metrics";
import type { AiMetricResult } from "./ai-metrics";

export type EvalSuggestion = {
  code: string;
  severity: "high" | "medium" | "low";
  message: string;
  questionId: string;
};

export function suggestImprovements(params: {
  gold: GoldQuestion;
  search: SearchMetricResult;
  ai: AiMetricResult;
  intentPass: boolean | null;
  emptyResults: boolean;
}): EvalSuggestion[] {
  const { gold, search, ai, intentPass, emptyResults } = params;
  const out: EvalSuggestion[] = [];
  const id = gold.id;

  if (intentPass === false) {
    out.push({
      code: "intent_mismatch",
      severity: "high",
      message: `Classifier intent mismatch for "${gold.query}" (expected ${gold.intent}). Strengthen patterns or aliases.`,
      questionId: id,
    });
  }

  if (search.top1Hit === false) {
    out.push({
      code: "top1_miss",
      severity: "high",
      message: `Top-1 miss for "${gold.query}". Check ranking weights, vertical filters, or missing listing metadata.`,
      questionId: id,
    });
  }

  if (search.top3Hit === false && search.top1Hit !== true) {
    out.push({
      code: "top3_miss",
      severity: "high",
      message: `Gold entities absent from Top-3 for "${gold.query}". Likely weak recall (embeddings/FTS) or missing taxonomy terms.`,
      questionId: id,
    });
  }

  if (search.wrongEntityType === true) {
    out.push({
      code: "wrong_entity_type",
      severity: "high",
      message: `Wrong entity/category for expected ${gold.expectEntityType ?? gold.expectVertical}. Add taxonomy terms or tighten vertical demotion.`,
      questionId: id,
    });
  }

  if (search.rankingError === true) {
    out.push({
      code: "ranking_error",
      severity: "medium",
      message: `Gold entity retrieved but ranked too low. Review rank-weights and attribute boosts.`,
      questionId: id,
    });
  }

  if (search.missedBusinesses.length > 0) {
    out.push({
      code: "missed_businesses",
      severity: "medium",
      message: `Missing gold businesses: ${search.missedBusinesses.slice(0, 3).join(", ")}. Check aliases, relations, or listing_terms.`,
      questionId: id,
    });
  }

  if (emptyResults && gold.requireSearch) {
    out.push({
      code: "empty_results",
      severity: "high",
      message: `No search results for "${gold.query}". Coverage gap — missing entities, categories, or knowledge card.`,
      questionId: id,
    });
  }

  if (gold.requireKnowledgeCard && !ai.knowledgeHit) {
    out.push({
      code: "missing_knowledge_card",
      severity: "medium",
      message: `Expected knowledge card${gold.expectKnowledgeCard ? ` (${gold.expectKnowledgeCard})` : ""} did not hit. Add/refresh card members.`,
      questionId: id,
    });
  }

  if (gold.requireLlm === false && ai.llmUsed) {
    out.push({
      code: "unexpected_llm",
      severity: "medium",
      message: `LLM used for deterministic query "${gold.query}". Improve classifier short-circuit or deterministic narration.`,
      questionId: id,
    });
  }

  if (gold.requireLlm === true && !ai.llmUsed && gold.intent === "PLANNING") {
    out.push({
      code: "missing_llm",
      severity: "low",
      message: `Planning query skipped LLM — verify composition quality is still adequate.`,
      questionId: id,
    });
  }

  if (
    ai.vectorHit === false &&
    ai.hybridHit === false &&
    gold.requireSearch &&
    !emptyResults &&
    ai.primaryRoute !== "knowledge" &&
    ai.primaryRoute !== "cache"
  ) {
    out.push({
      code: "weak_embeddings",
      severity: "low",
      message: `Results without vector/hybrid signal — may be lexical-only. Consider embedding refresh.`,
      questionId: id,
    });
  }

  if (search.missingMetadata > 0) {
    out.push({
      code: "missing_metadata",
      severity: "low",
      message: `${search.missingMetadata} result(s) missing category/description/phone metadata.`,
      questionId: id,
    });
  }

  if (search.duplicateResults > 0) {
    out.push({
      code: "duplicate_results",
      severity: "low",
      message: `Duplicate results detected (${search.duplicateResults}). Check dedupe in search merge.`,
      questionId: id,
    });
  }

  if (!gold.expectVertical && gold.requireSearch && search.top1Hit === false) {
    out.push({
      code: "missing_taxonomy",
      severity: "medium",
      message: `No expectVertical on failing search query — add taxonomy label to improve eval signal.`,
      questionId: id,
    });
  }

  return out;
}

export function aggregateSuggestionCodes(
  suggestions: EvalSuggestion[],
): Array<{ code: string; count: number; severity: string }> {
  const map = new Map<string, { count: number; severity: string }>();
  for (const s of suggestions) {
    const prev = map.get(s.code);
    if (prev) prev.count += 1;
    else map.set(s.code, { count: 1, severity: s.severity });
  }
  return [...map.entries()]
    .map(([code, v]) => ({ code, count: v.count, severity: v.severity }))
    .sort((a, b) => b.count - a.count);
}
