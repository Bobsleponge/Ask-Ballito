import type { BusinessResult } from "@/lib/schemas/business";
import type { PlannerPlan } from "@/services/planner/types";
import {
  emptyComposition,
  MAX_COMPOSITION_BUSINESSES,
  type ExperienceComposition,
  type ExperienceSection,
} from "./types";
import { composeRankedList } from "./strategies/ranked-list";
import { composeNearestFirst } from "./strategies/nearest-first";
import { composeGroupedSections } from "./strategies/grouped-sections";
import { composeComparison } from "./strategies/comparison";
import { composeItinerary } from "./strategies/itinerary";

/** Trim section membership so total unique businesses ≤ max. */
function capSections(
  sections: ExperienceSection[],
  max: number,
): ExperienceSection[] {
  let remaining = max;
  const out: ExperienceSection[] = [];
  for (const section of sections) {
    if (remaining <= 0) break;
    const ids = section.businessIds.slice(0, remaining);
    if (ids.length === 0) continue;
    remaining -= ids.length;
    out.push({ ...section, businessIds: ids });
  }
  return out;
}

/**
 * Materialise a presentation from ranked businesses + planner composition request.
 */
export function composeExperience(
  ranked: BusinessResult[],
  plan: PlannerPlan,
): ExperienceComposition {
  const request = plan.composition;
  if (ranked.length === 0) {
    return emptyComposition(request.strategy);
  }

  let sections: ExperienceSection[] = [];
  let strategy = request.strategy;

  switch (request.strategy) {
    case "nearest_first": {
      const result = composeNearestFirst(ranked, request, plan.locationRef);
      sections = result.sections;
      if (result.fellBack) strategy = "ranked_list";
      break;
    }
    case "grouped_sections":
      sections = composeGroupedSections(ranked, request);
      break;
    case "comparison":
      sections = composeComparison(ranked, request);
      break;
    case "itinerary":
      sections = composeItinerary(ranked, request);
      break;
    case "ranked_list":
    default:
      sections = composeRankedList(ranked, request);
      break;
  }

  // Guarantee at least one section when businesses exist.
  if (sections.length === 0) {
    sections = composeRankedList(ranked, {
      ...request,
      strategy: "ranked_list",
      titleHint: request.titleHint ?? "Top matches",
      maxItemsPerSection: MAX_COMPOSITION_BUSINESSES,
    });
    strategy = "ranked_list";
  }

  sections = capSections(sections, MAX_COMPOSITION_BUSINESSES);

  const usedIds = new Set(sections.flatMap((s) => s.businessIds));
  const businesses = ranked.filter((b) => usedIds.has(b.id));
  const byId = new Map(ranked.map((b) => [b.id, b]));
  for (const id of usedIds) {
    if (!businesses.some((b) => b.id === id)) {
      const b = byId.get(id);
      if (b) businesses.push(b);
    }
  }

  return {
    strategy,
    title: request.titleHint,
    sections,
    businesses,
  };
}

/** Plain-text fallback (debug / non-UI). Prefer formatCompositionConversational for chat. */
export function formatCompositionPlain(
  composition: ExperienceComposition,
): string {
  if (composition.sections.length === 0) return "";
  const byId = new Map(composition.businesses.map((b) => [b.id, b]));
  return composition.sections
    .map((section) => {
      const names = section.businessIds
        .map((id) => byId.get(id)?.name)
        .filter(Boolean)
        .join(", ");
      return names ? `${section.title}: ${names}` : section.title;
    })
    .join("\n");
}
