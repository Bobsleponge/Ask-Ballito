/**
 * Exclusive primary-layer failure taxonomy for Query Intelligence RCA.
 */

export const FAILURE_LAYERS = [
  "misunderstanding",
  "wrong_domain",
  "missing_facet",
  "bad_generated_search_query",
  "missing_data",
  "taxonomy_failure",
  "retrieval_failure",
  "over_filtering",
  "ranking_failure",
  "composition_failure",
  "narration_failure",
] as const;

export type FailureLayer = (typeof FAILURE_LAYERS)[number];

export type FailureLabel = {
  primary: FailureLayer;
  secondaries: FailureLayer[];
  rationale: string;
  shortCircuitLikelyCause: boolean;
  extractorWouldHelp: boolean;
};

const SUGGESTION_TO_LAYER: Record<string, FailureLayer> = {
  intent_mismatch: "misunderstanding",
  wrong_entity_type: "taxonomy_failure",
  ranking_error: "ranking_failure",
  top1_miss: "ranking_failure",
  top3_miss: "retrieval_failure",
  missed_businesses: "retrieval_failure",
  empty_results: "missing_data",
  missing_knowledge_card: "missing_data",
  missing_metadata: "missing_data",
  unexpected_llm: "composition_failure",
  missing_llm: "narration_failure",
};

/** Open-ended asks that need multi-concept / facets — short-circuit is harmful. */
const MULTI_NEED_RE =
  /\b(kids?\s+can\s+play|somewhere\s+(?:my\s+)?kids|rainy\s+day|propos(?:e|al)|birthday|anniversary|day\s+off|without\s+(?:the\s+)?kids|plan\s+(?:a\s+)?(?:party|celebration)|fun\s+things|what\s+can\s+we\s+do)\b/i;

const ATTRIBUTE_RE =
  /\b(dog[- ]?friendly|generator|open\s+after|wheelchair|parking|family[- ]?friendly|pet[- ]?friendly|kids?\s+menu)\b/i;

const GEO_NEAR_RE = /\bnear\s+(salt\s+rock|ballito\s+junction|lifestyle)\b/i;

/**
 * Heuristic primary-layer label from baseline suggestion codes + structural draft richness.
 * Used offline when full human labeling is not yet available.
 */
export function labelFailureHeuristic(input: {
  query: string;
  suggestions: string[];
  passIntent: boolean | null;
  passTop1: boolean | null;
  passTop3: boolean | null;
  shortCircuitDraft: {
    draftQueryCount: number;
    planFacetCount: number;
    constraintSignalCount: number;
  };
  extractorDraft?: {
    draftQueryCount: number;
    planFacetCount: number;
    constraintSignalCount: number;
  } | null;
}): FailureLabel {
  const secondaries: FailureLayer[] = [];
  const codes = input.suggestions;
  const multiNeed = MULTI_NEED_RE.test(input.query);
  const thinShortCircuit =
    input.shortCircuitDraft.planFacetCount === 0 &&
    input.shortCircuitDraft.draftQueryCount <= 1 &&
    input.shortCircuitDraft.constraintSignalCount <= 1;

  const extractorRicher =
    input.extractorDraft != null &&
    (input.extractorDraft.planFacetCount >
      input.shortCircuitDraft.planFacetCount ||
      input.extractorDraft.draftQueryCount >
        input.shortCircuitDraft.draftQueryCount + 1 ||
      input.extractorDraft.constraintSignalCount >
        input.shortCircuitDraft.constraintSignalCount + 1);

  let primary: FailureLayer = "ranking_failure";
  let rationale = "Default: gold entity retrieved but ranked poorly or Top-1 fragile.";
  let shortCircuitLikelyCause = false;

  if (multiNeed && thinShortCircuit) {
    primary = "missing_facet";
    rationale =
      "Open-ended / multi-need ask short-circuited with empty planFacets and a single draft query.";
    shortCircuitLikelyCause = true;
  } else if (input.passIntent === false || codes.includes("intent_mismatch")) {
    primary = "misunderstanding";
    rationale = "Classifier / intent family mismatch — understanding layer failed first.";
    shortCircuitLikelyCause = thinShortCircuit;
  } else if (ATTRIBUTE_RE.test(input.query) && thinShortCircuit) {
    primary = "bad_generated_search_query";
    rationale =
      "Attribute-heavy ask used a thin classifier draft query without structured constraints/concepts.";
    shortCircuitLikelyCause = true;
  } else if (codes.includes("wrong_entity_type")) {
    primary = "taxonomy_failure";
    rationale = "Wrong entity/category relative to gold — taxonomy or vertical mapping.";
    if (thinShortCircuit) secondaries.push("misunderstanding");
  } else if (codes.includes("empty_results") || codes.includes("missing_metadata")) {
    primary = codes.includes("empty_results") ? "missing_data" : "missing_data";
    rationale = "Coverage / metadata gap on listings or knowledge cards.";
    if (GEO_NEAR_RE.test(input.query)) secondaries.push("ranking_failure");
  } else if (codes.includes("top3_miss") && input.passTop3 === false) {
    primary = "retrieval_failure";
    rationale = "Gold entities absent from Top-3 — recall / query generation failure.";
    if (thinShortCircuit) {
      shortCircuitLikelyCause = true;
      secondaries.push("bad_generated_search_query");
    }
  } else if (codes.includes("ranking_error") || input.passTop1 === false) {
    primary = "ranking_failure";
    rationale = "Gold present in candidates but ranked too low, or Top-1 miss with Top-3 hit.";
    if (GEO_NEAR_RE.test(input.query)) secondaries.push("retrieval_failure");
  }

  for (const code of codes) {
    const layer = SUGGESTION_TO_LAYER[code];
    if (layer && layer !== primary && !secondaries.includes(layer)) {
      secondaries.push(layer);
    }
  }

  return {
    primary,
    secondaries: secondaries.slice(0, 3),
    rationale,
    shortCircuitLikelyCause,
    extractorWouldHelp: shortCircuitLikelyCause || extractorRicher || multiNeed,
  };
}

export function countConstraintSignals(constraints: {
  preferred: object;
  required: object;
  openNow: boolean | null;
  budget: string | null;
}): number {
  let n = 0;
  for (const v of Object.values(constraints.preferred as Record<string, unknown>)) {
    if (v != null) n += 1;
  }
  for (const v of Object.values(constraints.required as Record<string, unknown>)) {
    if (v != null) n += 1;
  }
  if (constraints.openNow != null) n += 1;
  if (constraints.budget != null) n += 1;
  return n;
}
