/**
 * Offline smoke for Experience Composition (no OpenAI / DB).
 * Run: npx tsx scripts/smoke-composition.ts
 */
import { composeExperience } from "../src/services/composition/compose";
import { buildCompositionRequest } from "../src/services/composition/request";
import { defaultCompositionRequest } from "../src/services/composition/types";
import type { BusinessResult } from "../src/lib/schemas/business";
import type { PlannerPlan } from "../src/services/planner/types";
import { emptyConstraintModel, emptyEntityModel } from "../src/services/planner/types";

function biz(
  id: string,
  name: string,
  opts: Partial<BusinessResult> = {},
): BusinessResult {
  return {
    id,
    name,
    category: opts.category ?? null,
    description: opts.description ?? null,
    address: opts.address ?? null,
    phone: null,
    website: null,
    rating: opts.rating ?? 4.5,
    ratingCount: 20,
    priceLevel: opts.priceLevel ?? 2,
    lat: opts.lat ?? null,
    lng: opts.lng ?? null,
    photos: [],
    score: opts.score ?? 80,
    metadata: opts.metadata,
  };
}

function basePlan(overrides: Partial<PlannerPlan> = {}): PlannerPlan {
  return {
    version: "v2",
    intent: "dining",
    goal: { primary: "find_coffee", description: "Find coffee" },
    workflow: "restaurants",
    confidence: 0.8,
    entities: emptyEntityModel(),
    constraints: emptyConstraintModel(),
    missingInformation: [],
    needsClarification: false,
    clarificationQuestion: null,
    executionPlan: [],
    llmRequired: true,
    responseMode: "execute_and_explain",
    locationRef: null,
    composition: defaultCompositionRequest("ranked_list"),
    diagnostics: {
      extractorConfidence: 0.8,
      rejectedWorkflows: [],
      rulesApplied: [],
      stickyEntitiesUsed: false,
    },
    ...overrides,
  };
}

const ranked = [
  biz("1", "Salt Rock Cafe", {
    category: "Cafe",
    priceLevel: 2,
    score: 90,
    lat: -29.5,
    lng: 31.2,
  }),
  biz("2", "Beach Espresso", {
    category: "Coffee Shop",
    priceLevel: 1,
    score: 85,
    lat: -29.51,
    lng: 31.21,
  }),
  biz("3", "Fine Dining House", {
    category: "Restaurant",
    priceLevel: 4,
    score: 80,
    lat: -29.6,
    lng: 31.3,
  }),
  biz("4", "Estate Agency Ballito", {
    category: "Estate Agent",
    priceLevel: 2,
    score: 75,
  }),
  biz("5", "Morning Bakery", {
    category: "Bakery",
    priceLevel: 1,
    score: 70,
    description: "Breakfast and coffee",
  }),
];

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

// Request rules
{
  const near = buildCompositionRequest({
    goalPrimary: "find_coffee",
    goalDescription: "coffee near Salt Rock",
    intent: "dining",
    workflowId: "restaurants",
    defaultStrategy: "ranked_list",
    entities: emptyEntityModel(),
    constraints: {
      ...emptyConstraintModel(),
      distanceLabel: "nearby",
      distanceMeters: 5000,
    },
    locationRef: {
      kind: "location",
      label: "Salt Rock",
      lat: -29.5,
      lng: 31.2,
      source: "turn",
    },
  });
  assert(near.request.strategy === "nearest_first", "expected nearest_first");

  const compare = buildCompositionRequest({
    goalPrimary: "compare_options",
    goalDescription: "compare cafe vs restaurant",
    intent: "dining",
    workflowId: "restaurants",
    defaultStrategy: "ranked_list",
    entities: emptyEntityModel(),
    constraints: emptyConstraintModel(),
    locationRef: null,
  });
  assert(compare.request.strategy === "comparison", "expected comparison");

  const day = buildCompositionRequest({
    goalPrimary: "plan_a_day",
    goalDescription: "plan a full day out",
    intent: "activities",
    workflowId: "activities",
    defaultStrategy: "ranked_list",
    entities: emptyEntityModel(),
    constraints: emptyConstraintModel(),
    locationRef: null,
  });
  assert(day.request.strategy === "itinerary", "expected itinerary");

  const relocate = buildCompositionRequest({
    goalPrimary: "relocate",
    goalDescription: "moving to Ballito",
    intent: "relocation",
    workflowId: "relocation",
    defaultStrategy: "grouped_sections",
    entities: emptyEntityModel(),
    constraints: emptyConstraintModel(),
    locationRef: null,
  });
  assert(
    relocate.request.strategy === "grouped_sections",
    "expected grouped_sections",
  );
}

// Compose strategies
{
  const list = composeExperience(ranked, basePlan());
  assert(list.strategy === "ranked_list", "compose ranked_list");
  assert(list.sections.length === 1, "one section");
  assert(list.sections[0].businessIds[0] === "1", "preserve rank order");

  const nearest = composeExperience(
    ranked,
    basePlan({
      locationRef: {
        kind: "location",
        label: "Salt Rock",
        lat: -29.5,
        lng: 31.2,
        source: "turn",
      },
      composition: defaultCompositionRequest("nearest_first"),
    }),
  );
  assert(nearest.strategy === "nearest_first", "compose nearest");
  assert(nearest.sections[0].kind === "nearest", "nearest kind");

  const grouped = composeExperience(
    ranked,
    basePlan({
      composition: defaultCompositionRequest("grouped_sections"),
    }),
  );
  assert(grouped.sections.length >= 2, "grouped has multiple sections");

  const compare = composeExperience(
    ranked,
    basePlan({
      composition: {
        ...defaultCompositionRequest("comparison"),
        maxItemsPerSection: 2,
        sectionHints: [
          {
            id: "a",
            title: "More affordable",
            kind: "compare_column",
          },
          {
            id: "b",
            title: "More upscale",
            kind: "compare_column",
          },
        ],
      },
    }),
  );
  assert(compare.sections.length === 2, "comparison two columns");
  assert(
    compare.sections.every((s) => s.kind === "compare_column"),
    "compare kinds",
  );

  const itinerary = composeExperience(
    ranked,
    basePlan({
      composition: {
        ...defaultCompositionRequest("itinerary"),
        maxSections: 3,
        maxItemsPerSection: 1,
        sectionHints: [
          {
            id: "morning",
            title: "Morning",
            kind: "itinerary_step",
            match: { categories: ["bakery", "cafe", "coffee"] },
          },
          {
            id: "afternoon",
            title: "Afternoon",
            kind: "itinerary_step",
            match: { categories: ["restaurant"] },
          },
          {
            id: "evening",
            title: "Evening",
            kind: "itinerary_step",
          },
        ],
      },
    }),
  );
  assert(itinerary.sections.length >= 2, "itinerary steps");
  assert(
    itinerary.sections.every((s) => s.kind === "itinerary_step"),
    "itinerary kinds",
  );
}

console.log("smoke-composition: ok");
