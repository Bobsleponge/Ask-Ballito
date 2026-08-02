/**
 * Feature flags for the intelligence-layer migration.
 * Defaults favour gradual rollout: classifier shadows in prod unless explicitly enabled.
 */

function flagEnabled(name: string, defaultOn: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return defaultOn;
  const v = raw.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(v)) return true;
  if (["0", "false", "no", "off"].includes(v)) return false;
  return defaultOn;
}

export const intelligenceFlags = {
  /** Log classifier predictions; do not short-circuit extractor. */
  classifierShadow: () => flagEnabled("CLASSIFIER_SHADOW", true),
  /** Skip PlannerExtractor when classifier confidence is high. */
  classifierShortCircuit: () =>
    flagEnabled("CLASSIFIER_SHORT_CIRCUIT", true),
  /** Set llmRequired=false for high-conf business/place/event searches. */
  deterministicNarrationSkip: () =>
    flagEnabled("DETERMINISTIC_NARRATION_SKIP", true),
  /** Use hybrid_match_businesses RPC instead of vector-only. */
  hybridSearch: () => flagEnabled("HYBRID_SEARCH", true),
  /** Serve knowledge cards when patterns match. */
  knowledgeCards: () => flagEnabled("KNOWLEDGE_CARDS", true),
  /** Cache composed answers in Upstash. */
  answerCache: () => flagEnabled("ANSWER_CACHE", true),
  /**
   * Deterministic Knowledge Resolver after classify/cache.
   * Default off for zero regression; when on, structured facts
   * (FAQ, emergency, weather, knowledge cards) short-circuit before search/AI.
   */
  knowledgeResolver: () => flagEnabled("KNOWLEDGE_RESOLVER", false),
  /**
   * Query Intelligence LLM as default semantic understanding for non-trivial NL.
   * When on, classifier short-circuit is limited to emergency/FAQ/exact commands.
   */
  queryIntelligence: () => flagEnabled("QUERY_INTELLIGENCE", false),
  /**
   * Log QI vs short-circuit drafts without serving QI (staging A/B).
   * No-op unless QUERY_INTELLIGENCE is off and this is on.
   */
  qiShadow: () => flagEnabled("QI_SHADOW", false),
  /**
   * Post-composition fit-verify LLM. Default on for legacy; when QUERY_INTELLIGENCE
   * is on, defaults off unless FIT_VERIFY is explicitly enabled.
   */
  fitVerify: () => {
    const raw = process.env.FIT_VERIFY;
    if (raw !== undefined && raw !== "") {
      return flagEnabled("FIT_VERIFY", false);
    }
    // QI path demotes fit-verify by default — spend tokens on understanding instead.
    if (flagEnabled("QUERY_INTELLIGENCE", false)) return false;
    return true;
  },
  /** Persist end-to-end query traces on the turn result / logs. */
  queryTrace: () => flagEnabled("QUERY_TRACE", false),
  /**
   * When QI understanding is present, skip resolver force_* vertical re-detection
   * (keep emergency / safety guards only).
   */
  qiTrustUnderstanding: () =>
    flagEnabled("QUERY_INTELLIGENCE", false) &&
    flagEnabled("QI_TRUST_UNDERSTANDING", true),
};

/** Confidence threshold to skip the LLM extractor. */
export const CLASSIFIER_SHORT_CIRCUIT_THRESHOLD = 0.85;

export const RANK_CONFIG_VERSION = "v2";
