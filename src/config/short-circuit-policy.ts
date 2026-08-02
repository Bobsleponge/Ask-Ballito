/**
 * Classifier short-circuit policy.
 * Pattern confidence is not semantic confidence — only obvious deterministic
 * cases may skip Query Intelligence / PlannerExtractor.
 */

import type { ClassificationResult } from "@/services/classifier/types";
import { intelligenceFlags } from "@/config/intelligence-flags";
import { CLASSIFIER_SHORT_CIRCUIT_THRESHOLD } from "@/config/intelligence-flags";

const SEARCH_FAMILY = new Set([
  "BUSINESS_SEARCH",
  "DISCOVERY",
  "PLACE_SEARCH",
  "EVENT_SEARCH",
  "LIVE_INFORMATION",
]);

/** Signals that are safe to answer without LLM understanding. */
const DETERMINISTIC_SIGNALS = new Set([
  "true_safety_emergency",
  "faq_match",
  "discover_card",
  "empty",
]);

/**
 * When Query Intelligence is on, only emergency / FAQ / exact discover cards /
 * empty greetings may skip the understanding LLM.
 */
export function isDeterministicClassifierOnly(
  classification: ClassificationResult,
): boolean {
  if (classification.confidence < CLASSIFIER_SHORT_CIRCUIT_THRESHOLD) {
    return false;
  }
  if (!classification.canSkipExtractor) return false;

  if (classification.signals.some((s) => DETERMINISTIC_SIGNALS.has(s))) {
    return true;
  }
  // Exact discover-card pattern ids end with discover_card signal already;
  // also allow FACT with very high confidence from FAQ patterns only.
  if (
    classification.queryClass === "FACT" &&
    classification.confidence >= 0.95 &&
    classification.signals.some(
      (s) => s.includes("faq") || s.includes("emergency") || s.includes("fact_"),
    )
  ) {
    return true;
  }

  return false;
}

/**
 * Whether the orchestrator should skip PlannerExtractor / Query Intelligence.
 */
export function shouldShortCircuitExtractor(
  classification: ClassificationResult,
): boolean {
  if (!intelligenceFlags.classifierShortCircuit()) return false;
  if (classification.confidence < CLASSIFIER_SHORT_CIRCUIT_THRESHOLD) {
    return false;
  }
  if (!classification.canSkipExtractor) return false;

  // QI mode: never short-circuit arbitrary NL search-family asks.
  if (intelligenceFlags.queryIntelligence()) {
    return isDeterministicClassifierOnly(classification);
  }

  // Legacy cost-aware path.
  return true;
}

/** Search-family classes that QI must understand (not rules-classify). */
export function isSearchFamilyClass(queryClass: string): boolean {
  return SEARCH_FAMILY.has(queryClass);
}
