import "server-only";
import type { City } from "@/config/cities";
import type { BusinessResult } from "@/lib/schemas/business";
import { businessSearchService } from "@/services/ai/business-search.service";
import { rankBusinesses } from "@/services/ai/ranking.engine";
import {
  emptyConstraintModel,
  emptyEntityModel,
  type PlannerPlan,
} from "@/services/planner/types";
import { defaultCompositionRequest } from "@/services/composition/types";
import {
  filterElevatedCasualDining,
  isElevatedCelebrationAsk,
  isDiningPlanFacet,
} from "@/services/planner/special-occasion-intent";
import { restaurantsDefinition } from "@/services/workflows/definitions/restaurants";

export interface SectionMoreParams {
  city: City;
  sectionId: string;
  sectionTitle: string;
  ask?: string;
  excludeBusinessIds: string[];
  limit?: number;
}

function inferDiningSection(sectionId: string, sectionTitle: string): boolean {
  return isDiningPlanFacet({
    label: sectionTitle,
    searchQuery: `${sectionId} ${sectionTitle}`,
    verticalHint: /dinner|dining|restaurant|cocktail|bar|brunch|cafe/i.test(
      `${sectionId} ${sectionTitle}`,
    )
      ? "restaurants"
      : null,
  });
}

function stubPlan(sectionTitle: string, ask: string): PlannerPlan {
  const elevated = isElevatedCelebrationAsk(ask);
  return {
    version: "v2",
    intent: ask.slice(0, 80) || sectionTitle,
    goal: {
      primary: elevated ? "plan_special_occasion" : "browse",
      description: ask || sectionTitle,
    },
    workflow: elevated ? "special_occasion" : "restaurants",
    confidence: 0.7,
    entities: emptyEntityModel(),
    constraints: {
      ...emptyConstraintModel(),
      budget: elevated ? "upscale" : null,
    },
    missingInformation: [],
    needsClarification: false,
    clarificationQuestion: null,
    executionPlan: [],
    llmRequired: false,
    responseMode: "execute_and_explain",
    locationRef: null,
    diagnostics: {
      extractorConfidence: 0.7,
      rejectedWorkflows: [],
      rulesApplied: ["section_more"],
      stickyEntitiesUsed: false,
    },
    composition: {
      ...defaultCompositionRequest("grouped_sections"),
      titleHint: sectionTitle,
    },
  };
}

/**
 * Fetch additional businesses for one composition section, excluding ids
 * already shown. No narration / full chat turn.
 */
export async function fetchMoreForSection(
  params: SectionMoreParams,
): Promise<BusinessResult[]> {
  const {
    city,
    sectionId,
    sectionTitle,
    ask = "",
    excludeBusinessIds,
    limit = 6,
  } = params;
  const exclude = new Set(
    excludeBusinessIds.map((id) => id.trim()).filter(Boolean),
  );
  const dining = inferDiningSection(sectionId, sectionTitle);
  const query = [sectionTitle, ask.slice(0, 120), city.name]
    .filter(Boolean)
    .join(" ")
    .trim();

  const raw = await businessSearchService.search({
    city,
    query: query || `${sectionTitle} ${city.name}`,
    limit: Math.max(limit * 4, 24),
  });

  let candidates = raw.filter((b) => !exclude.has(b.id));
  if (candidates.length === 0) return [];

  const plan = stubPlan(sectionTitle, ask);
  const ranked = rankBusinesses(candidates, plan, {
    ...restaurantsDefinition.rankConfig,
    ...(dining ? { verticalHint: "restaurants" as const } : {}),
    preferVariety: true,
    limit: Math.max(limit * 3, 18),
    minKeep: Math.min(limit, 4),
  });

  let next = ranked.filter((b) => !exclude.has(b.id));
  if (dining && isElevatedCelebrationAsk(ask)) {
    const facetId =
      sectionId.replace(/^facet_/, "").split("__")[0] || "dinner";
    next = next.map((b) => ({
      ...b,
      metadata: {
        ...(b.metadata ?? {}),
        planFacetId:
          typeof b.metadata?.planFacetId === "string"
            ? b.metadata.planFacetId
            : facetId,
      },
    }));
    next = filterElevatedCasualDining(next, {
      elevated: true,
      facets: [
        {
          id: facetId,
          label: sectionTitle,
          searchQuery: sectionTitle,
          verticalHint: "restaurants",
        },
      ],
    });
  }

  return next.slice(0, Math.min(Math.max(limit, 1), 12));
}
