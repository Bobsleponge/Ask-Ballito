/**
 * Complexity scheduled for removal once Query Intelligence is the default
 * understanding path (`QUERY_INTELLIGENCE=1` proven on gold + live evals).
 *
 * Do NOT add new vertical force rules / regex detectors here — fix QI gold instead.
 *
 * Retire when metrics hold:
 * 1. draftFromClassification for search-family asks
 * 2. Broad canSkipExtractor short-circuit for BUSINESS/DISCOVERY/PLACE/EVENT
 * 3. Resolver force_* for product/music/auto (keep emergency/medical safety)
 * 4. Conversation niche deepen loops (product/music/auto query regeneration)
 * 5. Fit-verify MULTI_NEED_EVENT_RE as understanding substitute
 * 6. Celebration-only facet special-casing in planner.v2 prompt
 * 7. eval:routing incentive that NL business must skip extractor
 * 8. Constraint regex duplicate in draftFromClassification
 *
 * Already gated behind QI flags:
 * - short-circuit policy → emergency/FAQ/commands only
 * - force_* skipped when qiTrustUnderstanding
 * - niche deepen skipped when QI draft has ≥2 concepts
 * - fit-verify default off when QUERY_INTELLIGENCE=1
 */

export const QI_COMPLEXITY_DEBT = [
  "draftFromClassification_search_family",
  "broad_classifier_short_circuit",
  "resolver_force_product_music_auto",
  "conversation_niche_deepen_loops",
  "fit_verify_as_understanding",
  "celebration_only_facet_prompt",
  "routing_eval_skip_extractor_incentive",
  "draftFromClassification_constraint_regex",
] as const;

export type QiComplexityDebtId = (typeof QI_COMPLEXITY_DEBT)[number];
