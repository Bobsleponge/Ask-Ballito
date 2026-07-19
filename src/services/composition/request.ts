import type { PlannerDraft, WorkflowDefinition } from "@/services/planner/types";
import type { LocationRef } from "@/services/planner/types";
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

  const wantsNear =
    Boolean(input.locationRef) &&
    (input.constraints.distanceMeters != null ||
      Boolean(input.constraints.distanceLabel) ||
      NEAR_RE.test(text));

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
        maxItemsPerSection: 3,
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
        maxItemsPerSection: 2,
        sectionHints: itineraryHints(),
      },
      rules,
    };
  }

  const multiType =
    input.entities.businessTypes.length >= 2 ||
    input.entities.cuisines.length >= 2;
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
        maxSections: 4,
        maxItemsPerSection: 4,
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
      maxSections: strategy === "grouped_sections" ? 4 : 1,
      maxItemsPerSection: strategy === "grouped_sections" ? 4 : 12,
    },
    rules,
  };
}
