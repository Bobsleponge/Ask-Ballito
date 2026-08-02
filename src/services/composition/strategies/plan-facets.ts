import type { BusinessResult } from "@/lib/schemas/business";
import {
  matchesVerticalHint,
  verticalsFromMetadata,
} from "@/lib/business-vertical-filter";
import {
  CELEBRATION_SECTION_ITEM_MIN,
  getPlanFacetId,
  isDiningPlanFacet,
} from "@/services/planner/special-occasion-intent";
import type { PlanFacet } from "@/services/planner/types";
import type { CompositionRequest, ExperienceSection } from "../types";

function isRestaurantLike(b: BusinessResult): boolean {
  const verts = verticalsFromMetadata(b.metadata);
  if (
    verts.includes("restaurants") ||
    verts.includes("bars") ||
    verts.includes("nightlife") ||
    verts.includes("cafes")
  ) {
    return true;
  }
  const hay = `${b.name} ${b.category ?? ""} ${b.description ?? ""}`.toLowerCase();
  return /restaurant|dining|bistro|grill|steak|seafood|sushi|pizza|cafe|coffee|cocktail|wine\s*bar|\bbar\b|brunch|fine\s*dining/i.test(
    hay,
  );
}

/** Exact service facets must not receive soft Pass-2 leftovers. */
const EXACT_PASS2_HINTS = new Set([
  "photography",
  "florists",
  "jewellery",
  "bakeries",
  "hotels",
]);

function isExactServiceFacet(facet: PlanFacet): boolean {
  if (facet.verticalHint && EXACT_PASS2_HINTS.has(facet.verticalHint)) {
    return true;
  }
  return /photograph|florist|flower|bouquet|jewell|ring|bakery|cake|hotel|overnight|stay/i.test(
    `${facet.id} ${facet.label} ${facet.searchQuery}`,
  );
}

function primaryDiningFacet(facets: PlanFacet[]): PlanFacet | null {
  const dining = facets.filter(isDiningPlanFacet);
  if (dining.length === 0) return null;
  return (
    dining.find((f) =>
      /dinner|dining|restaurant|meal/i.test(`${f.id} ${f.label}`),
    ) ??
    dining[0] ??
    null
  );
}

function sectionMinItems(request: CompositionRequest): number {
  if (
    typeof request.minItemsPerSection === "number" &&
    Number.isFinite(request.minItemsPerSection)
  ) {
    return Math.max(1, Math.floor(request.minItemsPerSection));
  }
  if (request.bucketProfile === "plan_facets") {
    return CELEBRATION_SECTION_ITEM_MIN;
  }
  return 1;
}

/**
 * Compose sections from planner facets using retrieval provenance
 * (metadata.planFacetId) with soft keyword/vertical fallback.
 * One checklist section per facet label (Entertainment, Cake, Dinner, …).
 * Sections below {@link sectionMinItems} are omitted.
 */
export function composePlanFacetSections(
  ranked: BusinessResult[],
  request: CompositionRequest,
): ExperienceSection[] {
  const facets = request.planFacets ?? [];
  if (facets.length === 0) return [];

  const minItems = sectionMinItems(request);
  const maxItems = Math.max(request.maxItemsPerSection, minItems);

  const byFacet = new Map<string, BusinessResult[]>();
  for (const f of facets) byFacet.set(f.id, []);

  const assigned = new Set<string>();
  const dinnerFacet = primaryDiningFacet(facets);

  // Pass 1: provenance from search step.
  for (const b of ranked) {
    const facetId = getPlanFacetId(b);
    if (!facetId || !byFacet.has(facetId)) continue;
    byFacet.get(facetId)!.push(b);
    assigned.add(b.id);
  }

  // Pass 1b: restaurants stuck on cake/venue/entertainment → dinner.
  if (dinnerFacet) {
    for (const facet of facets) {
      if (isDiningPlanFacet(facet)) continue;
      const list = byFacet.get(facet.id) ?? [];
      const keep: BusinessResult[] = [];
      for (const b of list) {
        if (isRestaurantLike(b)) {
          byFacet.get(dinnerFacet.id)!.push(b);
        } else {
          keep.push(b);
        }
      }
      byFacet.set(facet.id, keep);
    }
  }

  // Pass 2: soft match remaining to a facet by vertical / query overlap.
  // Skip exact service facets (photo/florist/jewellery/bakeries) — empty > junk.
  for (const b of ranked) {
    if (assigned.has(b.id)) continue;
    if (dinnerFacet && isRestaurantLike(b)) {
      byFacet.get(dinnerFacet.id)!.push(b);
      assigned.add(b.id);
      continue;
    }
    const matchId = bestFacetMatch(b, facets);
    if (!matchId) continue;
    const matchFacet = facets.find((f) => f.id === matchId);
    if (matchFacet && isExactServiceFacet(matchFacet)) continue;
    byFacet.get(matchId)!.push(b);
    assigned.add(b.id);
  }

  // Pass 2b: fill thin exact-service facets from on-vertical matches only.
  for (const facet of facets) {
    if (!isExactServiceFacet(facet) || !facet.verticalHint) continue;
    const list = byFacet.get(facet.id) ?? [];
    if (list.length >= maxItems) continue;
    for (const b of ranked) {
      if (assigned.has(b.id)) continue;
      if (!matchesVerticalHint(b, facet.verticalHint)) continue;
      // Don't steal restaurants into service facets.
      if (isRestaurantLike(b) && !isDiningPlanFacet(facet)) continue;
      list.push(b);
      assigned.add(b.id);
      if (list.length >= maxItems) break;
    }
    byFacet.set(facet.id, list);
  }

  // Deduplicate within each facet (reassign can double-add).
  for (const [id, list] of byFacet) {
    const seen = new Set<string>();
    byFacet.set(
      id,
      list.filter((b) => {
        if (seen.has(b.id)) return false;
        seen.add(b.id);
        return true;
      }),
    );
  }

  const sections: ExperienceSection[] = [];
  for (const facet of facets) {
    if (sections.length >= request.maxSections) break;
    const items = byFacet.get(facet.id) ?? [];
    // Minimum-of-3 (or request.min): prefer omit over a sparse one-option section.
    if (items.length < minItems) continue;
    const ids = items.slice(0, maxItems).map((b) => b.id);
    sections.push({
      id: `facet_${facet.id}`,
      title: facet.label,
      subtitle: null,
      kind: "list",
      businessIds: ids,
    });
  }

  return sections;
}

function bestFacetMatch(
  b: BusinessResult,
  facets: Array<{
    id: string;
    label: string;
    searchQuery: string;
    verticalHint: string | null;
  }>,
): string | null {
  const verts = verticalsFromMetadata(b.metadata);
  const hay = `${b.name} ${b.category ?? ""} ${b.description ?? ""}`.toLowerCase();

  let best: { id: string; score: number } | null = null;
  for (const f of facets) {
    if (isExactServiceFacet(f as PlanFacet)) continue;
    let score = 0;
    if (f.verticalHint && verts.includes(f.verticalHint)) score += 5;
    // bars ↔ nightlife alias for soft match
    if (
      f.verticalHint === "bars" &&
      (verts.includes("bars") || verts.includes("nightlife"))
    ) {
      score += 5;
    }
    const tokens = `${f.label} ${f.searchQuery}`
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 4);
    for (const t of tokens) {
      if (hay.includes(t)) score += 1;
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { id: f.id, score };
    }
  }
  return best && best.score >= 2 ? best.id : null;
}
