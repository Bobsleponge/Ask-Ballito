/**
 * Run one gold question through classifier + search + orchestrator (eval mode).
 */
import "server-only";
import { getCity } from "@/config/cities";
import { classifyQuery } from "@/services/classifier/classify";
import { businessSearchService } from "@/services/ai/business-search.service";
import { conversationService } from "@/services/ai/conversation.service";
import { findKnowledgeCard } from "@/services/knowledge/knowledge-cards.service";
import { estimateCostUsd } from "@/config/ai-pricing";
import { createTurnTelemetry } from "@/services/routing/types";
import type { GoldQuestion } from "./types";
import { intentMatches } from "./gold";
import {
  computeSearchMetrics,
  type SearchMetricResult,
} from "./search-metrics";
import { computeAiMetrics, type AiMetricResult } from "./ai-metrics";
import { suggestImprovements, type EvalSuggestion } from "./suggestions";

export type QuestionEvalOutcome = {
  questionId: string;
  query: string;
  intentExpected: string;
  intentDetected: string | null;
  passIntent: boolean;
  passTop1: boolean | null;
  passTop3: boolean | null;
  passTop5: boolean | null;
  search: SearchMetricResult;
  ai: AiMetricResult;
  suggestions: EvalSuggestion[];
  metrics: Record<string, unknown>;
  finalResponse: string;
  resultIds: string[];
};

function missingMetadataCount(
  businesses: Array<{
    category: string | null;
    description: string | null;
    phone: string | null;
  }>,
): number {
  return businesses.filter(
    (b) => !b.category || !b.description || !b.phone,
  ).length;
}

function duplicateCount(ids: string[]): number {
  return ids.length - new Set(ids).size;
}

/**
 * Map gold intents that are not QueryClass onto classifier-friendly expectations.
 */
function normalizeDetectedIntent(
  detected: string,
  gold: GoldQuestion,
): string {
  if (gold.intent === "EMERGENCY" && detected === "BUSINESS_SEARCH") {
    return detected;
  }
  return detected;
}

export async function evaluateQuestion(
  gold: GoldQuestion,
  opts?: { skipOrchestrator?: boolean; searchLimit?: number },
): Promise<QuestionEvalOutcome> {
  const city = getCity(gold.city);
  if (!city) {
    throw new Error(`Unknown city: ${gold.city}`);
  }

  const classification = classifyQuery({
    message: gold.query,
    citySlug: city.slug,
  });
  const intentDetected = normalizeDetectedIntent(
    classification.queryClass,
    gold,
  );
  const passIntent = intentMatches(intentDetected, gold.intent);

  let resultIds: string[] = [];
  let resultCategories: Array<string | null> = [];
  let resultVerticals: Array<string | null> = [];
  let duplicates = 0;
  let missingMeta = 0;
  let retrievalMode: string | null = null;
  let knowledgeCardHit = false;
  let llmUsed = false;
  let promptTokens = 0;
  let completionTokens = 0;
  let estimatedCostUsd = 0;
  let finalResponse = "";
  let telemetry = createTurnTelemetry({
    queryClass: classification.queryClass,
    classifierConfidence: classification.confidence,
    classifierSignals: classification.signals,
  });

  const card = await findKnowledgeCard({
    citySlug: city.slug,
    message: gold.query,
  });
  if (card) knowledgeCardHit = true;

  if (opts?.skipOrchestrator) {
    const searchStart = Date.now();
    const results = gold.requireSearch
      ? await businessSearchService.search({
          query: gold.query,
          citySlug: city.slug,
          limit: opts.searchLimit ?? 10,
        })
      : [];
    const searchMs = Date.now() - searchStart;
    resultIds = results.map((b) => b.id);
    resultCategories = results.map((b) => b.category);
    resultVerticals = results.map((b) => {
      const meta = b.metadata ?? {};
      const v = meta.verticals ?? meta.vertical;
      if (Array.isArray(v)) return String(v[0] ?? "");
      return typeof v === "string" ? v : null;
    });
    duplicates = duplicateCount(resultIds);
    missingMeta = missingMetadataCount(results);
    retrievalMode = "hybrid";
    telemetry = {
      ...telemetry,
      latencyMs: searchMs,
      retrievalMode: "hybrid",
      candidateCount: results.length,
      stageLatencyMs: { search: searchMs },
      primaryRoute: knowledgeCardHit ? "knowledge" : "hybrid",
      routePaths: knowledgeCardHit ? ["knowledge", "hybrid"] : ["hybrid"],
    };
    finalResponse = results.map((b) => b.name).join(", ");
  } else {
    const completed = await conversationService.complete({
      city,
      message: gold.query,
      skipAnswerCache: true,
      retry: true,
    });
    telemetry = {
      ...completed.telemetry,
      latencyMs: completed.telemetry.latencyMs,
    };
    llmUsed = completed.llmInvoked || completed.telemetry.llmUsed;
    resultIds = completed.businesses.map((b) => b.id);
    resultCategories = completed.businesses.map((b) => b.category);
    resultVerticals = completed.businesses.map((b) => {
      const meta = b.metadata ?? {};
      const v = meta.verticals ?? meta.vertical;
      if (Array.isArray(v)) return String(v[0] ?? "");
      return typeof v === "string" ? v : null;
    });
    duplicates = duplicateCount(resultIds);
    missingMeta = missingMetadataCount(completed.businesses);
    retrievalMode = completed.telemetry.retrievalMode;
    finalResponse = completed.text.slice(0, 2000);
    knowledgeCardHit =
      knowledgeCardHit ||
      completed.telemetry.routePaths.includes("knowledge") ||
      completed.telemetry.primaryRoute === "knowledge";

    // Cost estimate: orchestrator log may not include child tokens; use 0 if unknown.
    estimatedCostUsd =
      estimateCostUsd({
        model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
        inputTokens: promptTokens,
        outputTokens: completionTokens,
      }) ?? 0;
  }

  const search = computeSearchMetrics(gold, {
    resultIds,
    resultCategories,
    resultVerticals,
    duplicates,
    missingMetadataCount: missingMeta,
    retrievalMode,
  });

  const ai = computeAiMetrics({
    telemetry,
    llmUsed,
    model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
    promptTokens,
    completionTokens,
    estimatedCostUsd,
    knowledgeCardHit,
    finalResponseLength: finalResponse.length,
  });

  const suggestions = suggestImprovements({
    gold,
    search,
    ai,
    intentPass: passIntent,
    emptyResults: gold.requireSearch && resultIds.length === 0,
  });

  return {
    questionId: gold.id,
    query: gold.query,
    intentExpected: gold.intent,
    intentDetected,
    passIntent,
    passTop1: search.top1Hit,
    passTop3: search.top3Hit,
    passTop5: search.top5Hit,
    search,
    ai,
    suggestions,
    resultIds,
    finalResponse,
    metrics: {
      search,
      ai,
      classification: {
        confidence: classification.confidence,
        signals: classification.signals,
        canSkipExtractor: classification.canSkipExtractor,
        preferDeterministicNarration:
          classification.preferDeterministicNarration,
      },
      resultIds: resultIds.slice(0, 10),
      knowledgeCardSlug: card?.slug ?? null,
      responsePreview: finalResponse.slice(0, 280),
    },
  };
}
