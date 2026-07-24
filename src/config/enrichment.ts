/**
 * Controls hybrid enrichment: Place Details for all businesses; Google reviews
 * only for service-heavy verticals where offerings are often mentioned in text.
 */

/** Verticals that receive up to MAX_REVIEWS Google review texts for LLM extraction. */
export const REVIEW_VERTICALS = new Set([
  "hair-salons",
  "barbershops",
  "beauticians",
  "spas",
  "plumbers",
  "electricians",
  "locksmiths",
  "handyman",
  "hvac",
  "fabrication",
  "automotive",
  "cleaning",
  "pool-services",
  "landscaping",
  "pest-control",
  "contractors",
  "movers",
  "security",
  "telecom",
  "dentists",
  "doctors",
  "pharmacies",
  "optometrists",
  "vets",
  "laundry",
  "fitness",
  "childcare",
  "bakeries",
  "takeaways",
]);

export const MAX_REVIEWS = 5;

/** Cap stored review snippets for debugging (full text is not persisted). */
export const MAX_REVIEW_SNIPPETS = 3;

export function wantsReviews(verticals: string[] | undefined | null): boolean {
  if (!verticals?.length) return false;
  return verticals.some((v) => REVIEW_VERTICALS.has(v));
}
