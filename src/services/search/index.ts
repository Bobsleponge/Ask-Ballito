import "server-only";
/**
 * Search Service — finds candidate facts.
 * Ranking orders facts. Narration explains facts.
 * These responsibilities must never overlap.
 */
export {
  BusinessSearchService,
  businessSearchService,
  type BusinessSearchParams,
} from "@/services/ai/business-search.service";

export { expandLocatedIn } from "@/lib/knowledge/relations";
export { expandQuerySynonyms } from "@/lib/knowledge/taxonomy";
