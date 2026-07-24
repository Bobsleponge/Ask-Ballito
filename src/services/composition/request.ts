import type { PlannerDraft, WorkflowDefinition } from "@/services/planner/types";
import type { LocationRef } from "@/services/planner/types";
import { isProductPurchaseAsk } from "@/services/planner/product-intent";
import { isMusicInstrumentAsk } from "@/services/planner/music-intent";
import { isExactNicheAsk } from "@/services/planner/exact-niche-guard";
import { celebrationTitleHint } from "@/services/planner/special-occasion-intent";
import { detectMealTime } from "@/services/planner/meal-time-intent";
import {
  defaultCompositionRequest,
  type CompositionRequest,
  type PresentationStrategy,
  type SectionHint,
} from "./types";

const COMPARE_RE =
  /\b(compare|comparison|versus|vs\.?|trade[- ]?off|which is better|options)\b/i;
const ITINERARY_RE =
  /\b(itinerary|day plan|plan a day|full day|morning|afternoon|evening|multi[- ]?stop|day out)\b/i;
const NEAR_RE = /\b(near|nearby|closest|nearest|walking distance|close to)\b/i;

function itineraryHints(): SectionHint[] {
  return [
    {
      id: "morning",
      title: "Morning",
      kind: "itinerary_step",
      match: {
        categories: ["cafe", "coffee", "breakfast", "bakery"],
        cuisines: ["coffee", "breakfast"],
      },
    },
    {
      id: "afternoon",
      title: "Afternoon",
      kind: "itinerary_step",
      match: {
        categories: [
          "attraction",
          "beach",
          "activity",
          "outdoor",
          "museum",
          "park",
        ],
      },
    },
    {
      id: "evening",
      title: "Evening",
      kind: "itinerary_step",
      match: {
        categories: ["restaurant", "dinner", "bar", "wine"],
        cuisines: ["dinner"],
      },
    },
  ];
}

export interface CompositionRequestInput {
  goalPrimary: string;
  goalDescription: string;
  intent: string;
  workflowId: WorkflowDefinition["id"];
  defaultStrategy: PresentationStrategy;
  entities: PlannerDraft["entities"];
  constraints: PlannerDraft["constraints"];
  locationRef: LocationRef | null;
  planFacets?: PlannerDraft["planFacets"];
}

/**
 * Deterministic composition request for the planner plan.
 * Returns the request plus rule ids for diagnostics.
 */
export function buildCompositionRequest(
  input: CompositionRequestInput,
): { request: CompositionRequest; rules: string[] } {
  const rules: string[] = [];
  const text = [
    input.goalPrimary,
    input.goalDescription,
    input.intent,
  ].join(" ");

  // Product / buy asks: flat ranked list — never raw Google category vibe sections.
  if (isProductPurchaseAsk(text)) {
    rules.push("composition_product_ranked");
    return {
      request: {
        ...defaultCompositionRequest("ranked_list"),
        titleHint: "Where to buy",
        maxSections: 1,
        maxItemsPerSection: 10,
        sectionHints: [],
        bucketProfile: undefined,
      },
      rules,
    };
  }

  if (isMusicInstrumentAsk(text)) {
    rules.push("composition_music_ranked");
    return {
      request: {
        ...defaultCompositionRequest("ranked_list"),
        titleHint: "Music & instruments",
        maxSections: 1,
        maxItemsPerSection: 10,
        sectionHints: [],
        bucketProfile: undefined,
      },
      rules,
    };
  }

  // Celebration planning — sections come from planner facets when present.
  const facets = (input.planFacets ?? []).filter(
    (f) => f.label?.trim() && f.searchQuery?.trim(),
  );
  if (input.workflowId === "special_occasion" || facets.length >= 2) {
    rules.push("composition_plan_facets");
    return {
      request: {
        ...defaultCompositionRequest("grouped_sections"),
        titleHint: celebrationTitleHint(
          text,
          input.goalDescription,
          input.goalPrimary,
        ),
        maxSections: Math.min(6, Math.max(3, facets.length || 4)),
        maxItemsPerSection: 8,
        sectionHints: facets.map((f) => ({
          id: f.id,
          title: f.label,
          kind: "list" as const,
        })),
        bucketProfile: facets.length >= 1 ? "plan_facets" : "activities",
        planFacets: facets,
      },
      rules,
    };
  }

  // Generic exact niche: never "Ideas by vibe" padding.
  if (isExactNicheAsk(text)) {
    rules.push("composition_exact_niche_ranked");
    return {
      request: {
        ...defaultCompositionRequest("ranked_list"),
        titleHint: "Matching options",
        maxSections: 1,
        maxItemsPerSection: 10,
        sectionHints: [],
        bucketProfile: undefined,
      },
      rules,
    };
  }

  const wantsNear =
    Boolean(input.locationRef) &&
    (input.constraints.distanceMeters != null ||
      Boolean(input.constraints.distanceLabel) ||
      NEAR_RE.test(text));

  const mealTime =
    detectMealTime(text) ??
    (input.constraints.preferred.breakfast === true
      ? "breakfast"
      : input.constraints.preferred.lunch === true
        ? "lunch"
        : input.constraints.preferred.dinner === true
          ? "dinner"
          : null);

  // Meal-time asks keep relevance order. Pure distance reorder buries breakfast
  // cafés under popular dinner spots that happen to be closer to the CBD.
  if (wantsNear && mealTime) {
    const mealTitle =
      mealTime === "breakfast"
        ? "Breakfast nearby"
        : mealTime === "lunch"
          ? "Lunch nearby"
          : "Dinner nearby";
    rules.push("composition_meal_ranked_over_nearest");
    return {
      request: {
        ...defaultCompositionRequest("ranked_list"),
        titleHint: input.locationRef
          ? `${mealTitle} · ${input.locationRef.label}`
          : mealTitle,
        maxSections: 1,
        maxItemsPerSection: 6,
        sectionHints: [],
        bucketProfile: undefined,
      },
      rules,
    };
  }

  if (wantsNear) {
    rules.push("composition_nearest_first");
    return {
      request: {
        ...defaultCompositionRequest("nearest_first"),
        titleHint: input.locationRef
          ? `Nearest to ${input.locationRef.label}`
          : "Nearest first",
        maxSections: 1,
        maxItemsPerSection: 12,
      },
      rules,
    };
  }

  if (COMPARE_RE.test(text)) {
    rules.push("composition_comparison");
    return {
      request: {
        ...defaultCompositionRequest("comparison"),
        titleHint: "Side-by-side options",
        maxSections: 2,
        maxItemsPerSection: 5,
        sectionHints: [
          {
            id: "option_a",
            title: "More affordable",
            kind: "compare_column",
            match: { priceBand: "lower" },
          },
          {
            id: "option_b",
            title: "More upscale",
            kind: "compare_column",
            match: { priceBand: "higher" },
          },
        ],
      },
      rules,
    };
  }

  if (
    ITINERARY_RE.test(text) ||
    /^(plan_a_day|day_out|itinerary|full_day)/.test(input.goalPrimary)
  ) {
    rules.push("composition_itinerary");
    return {
      request: {
        ...defaultCompositionRequest("itinerary"),
        titleHint: "Suggested day plan",
        maxSections: 3,
        maxItemsPerSection: 4,
        sectionHints: itineraryHints(),
      },
      rules,
    };
  }

  const multiType =
    input.entities.businessTypes.length >= 2 ||
    input.entities.cuisines.length >= 2;

  // Activities: group beaches / adventures / malls — not a flat card dump.
  // (special_occasion already handled above)
  if (input.workflowId === "activities") {
    rules.push("composition_activities_grouped");
    return {
      request: {
        ...defaultCompositionRequest("grouped_sections"),
        titleHint: "Weekend ideas by vibe",
        maxSections: 5,
        maxItemsPerSection: 5,
        bucketProfile: "activities",
      },
      rules,
    };
  }

  if (input.workflowId === "relocation" || multiType) {
    rules.push(
      input.workflowId === "relocation"
        ? "composition_grouped_relocation"
        : "composition_grouped_multi_type",
    );
    return {
      request: {
        ...defaultCompositionRequest("grouped_sections"),
        titleHint:
          input.workflowId === "relocation"
            ? "Settling-in checklist"
            : "Ideas by vibe",
        maxSections: 5,
        maxItemsPerSection: 5,
      },
      rules,
    };
  }

  const strategy = input.defaultStrategy;
  rules.push(`composition_default_${strategy}`);
  return {
    request: {
      ...defaultCompositionRequest(strategy),
      titleHint:
        strategy === "grouped_sections" ? "Ideas by vibe" : "A few solid options",
      maxSections: strategy === "grouped_sections" ? 5 : 1,
      // Flat lists stay modest; grouped discovery can accumulate toward the 25 ceiling.
      maxItemsPerSection: strategy === "grouped_sections" ? 5 : 12,
    },
    rules,
  };
}
