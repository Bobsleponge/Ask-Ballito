/**
 * Offline smoke: breakfast "near me" must keep meal relevance over pure distance.
 * Run: npx tsx scripts/smoke-breakfast-relevance.ts
 */
import {
  detectMealTime,
  mealTimeFitScore,
  isOutOfAreaAddress,
} from "../src/services/planner/meal-time-intent";
import { buildCompositionRequest } from "../src/services/composition/request";
import { rankBusinesses } from "../src/services/ai/ranking.engine";
import type { BusinessResult } from "../src/lib/schemas/business";
import {
  emptyConstraintModel,
  emptyEntityModel,
  type PlannerPlan,
} from "../src/services/planner/types";
import { defaultCompositionRequest } from "../src/services/composition/types";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function biz(
  id: string,
  name: string,
  opts: Partial<BusinessResult> & { breakfast?: boolean | null } = {},
): BusinessResult {
  const { breakfast, metadata, ...rest } = opts;
  return {
    id,
    name,
    category: rest.category ?? null,
    description: rest.description ?? null,
    address: rest.address ?? null,
    phone: null,
    website: null,
    rating: rest.rating ?? 4.5,
    ratingCount: rest.ratingCount ?? 100,
    priceLevel: rest.priceLevel ?? 2,
    lat: rest.lat ?? null,
    lng: rest.lng ?? null,
    photos: [],
    score: rest.score ?? 70,
    similarity: rest.similarity ?? 0.5,
    metadata: {
      ...(metadata as Record<string, unknown> | undefined),
      ...(breakfast !== undefined ? { attributes: { breakfast } } : {}),
    },
  };
}

assert(
  detectMealTime("Best breakfast near me in Ballito") === "breakfast",
  "detect breakfast",
);
assert(isOutOfAreaAddress("Essenwood, Berea, 4001"), "berea out of area");
assert(
  !isOutOfAreaAddress("Ballito Junction, Leonora Dr, Ballito"),
  "ballito local",
);

{
  const catia = mealTimeFitScore("breakfast", {
    name: "Catia's Cafe",
    category: "Restaurant",
    description: "Great breakfast options",
    breakfast: true,
  });
  const cake = mealTimeFitScore("breakfast", {
    name: "THAT CAKE LADY",
    category: "Bakery",
    description: "birthday cakes",
    breakfast: null,
  });
  const stand = mealTimeFitScore("breakfast", {
    name: "Local Coffee Ballito",
    category: "Coffee Stand",
    description: "Quick coffee",
    breakfast: null,
  });
  const breadMill = mealTimeFitScore("breakfast", {
    name: "The Bread Mill",
    category: "Bakery",
    description: "caramel cake",
    address: "18-22 Problem Mkhize Rd, Essenwood, Berea, 4001",
    breakfast: null,
  });
  assert(catia.fit >= 5, "Catia strong breakfast fit");
  assert(cake.leanAgainst, "cake shop lean against");
  assert(stand.leanAgainst, "coffee stand lean against");
  assert(breadMill.leanAgainst, "Berea bakery lean against");
}

{
  const req = buildCompositionRequest({
    goalPrimary: "find_breakfast",
    goalDescription: "Best breakfast near me in Ballito",
    intent: "dining",
    workflowId: "restaurants",
    defaultStrategy: "ranked_list",
    entities: emptyEntityModel(),
    constraints: {
      ...emptyConstraintModel(),
      preferred: {
        ...emptyConstraintModel().preferred,
        breakfast: true,
      },
    },
    locationRef: {
      kind: "location",
      label: "Ballito",
      lat: -29.539,
      lng: 31.214,
      source: "turn",
    },
  });
  assert(req.request.strategy === "ranked_list", "ranked_list for breakfast");
  assert(req.request.maxItemsPerSection === 6, "tight breakfast list");
}

{
  const origin = { lat: -29.539, lng: 31.214 };
  const candidates = [
    biz("moz", "Mozambik Ballito", {
      category: "Restaurant",
      description: "Lively Portuguese restaurant",
      similarity: 0.72,
      rating: 4.5,
      ratingCount: 4300,
      lat: origin.lat + 0.001,
      lng: origin.lng + 0.001,
      breakfast: null,
    }),
    biz("catia", "Catia's Cafe", {
      category: "Restaurant",
      description: "Welcoming cafe with great breakfast options",
      similarity: 0.55,
      rating: 4.6,
      ratingCount: 89,
      lat: origin.lat + 0.01,
      lng: origin.lng + 0.01,
      address: "Ballito Junction, Ballito",
      breakfast: true,
    }),
    biz("concha", "Concha", {
      category: "Cafe",
      description: "Coffee, smoothies, and breakfast wraps",
      similarity: 0.58,
      rating: 4.5,
      ratingCount: 1400,
      lat: origin.lat + 0.008,
      lng: origin.lng + 0.008,
      address: "Compensation Beach Rd, Ballito",
      breakfast: null,
    }),
    biz("grand", "Grand Exotic", {
      category: "Cafe",
      description: "Breakfast and brunch menu",
      similarity: 0.56,
      rating: 4.6,
      ratingCount: 1100,
      lat: origin.lat + 0.02,
      lng: origin.lng + 0.02,
      address: "Sheffield Beach Rd, Sheffield Beach, Ballito",
      breakfast: true,
    }),
    biz("cake", "THAT CAKE LADY", {
      category: "Bakery",
      description: "birthday cakes",
      similarity: 0.5,
      rating: 5,
      ratingCount: 16,
      lat: origin.lat + 0.015,
      lng: origin.lng + 0.015,
      breakfast: null,
    }),
    biz("stand", "Local Coffee Ballito", {
      category: "Coffee Stand",
      description: "Coffee on the beach",
      similarity: 0.52,
      rating: 4.9,
      ratingCount: 37,
      lat: origin.lat + 0.003,
      lng: origin.lng + 0.003,
      breakfast: null,
    }),
    biz("steers", "Steers Ballito Junction", {
      category: "Hamburger Restaurant",
      description: "flame-grilled beef burgers",
      similarity: 0.6,
      rating: 4.7,
      ratingCount: 644,
      lat: origin.lat + 0.004,
      lng: origin.lng + 0.004,
      breakfast: null,
    }),
    biz("checkers", "Checkers Ballito Junction", {
      category: "Supermarket",
      description: "butcher shop",
      similarity: 0.55,
      rating: 4.5,
      ratingCount: 1800,
      lat: origin.lat + 0.004,
      lng: origin.lng + 0.004,
      breakfast: null,
    }),
    biz("hotel", "Hampshire Hotel-Ballito", {
      category: "Hotel",
      description: "free wi-fi",
      similarity: 0.5,
      rating: 4.2,
      ratingCount: 862,
      lat: origin.lat + 0.005,
      lng: origin.lng + 0.005,
      breakfast: null,
    }),
    biz("kuta", "Kuta-Kola", {
      category: "Restaurant",
      description: "lunch service",
      similarity: 0.62,
      rating: 4.6,
      ratingCount: 928,
      lat: origin.lat + 0.002,
      lng: origin.lng + 0.002,
      breakfast: null,
    }),
    biz("bread", "The Bread Mill", {
      category: "Bakery",
      description: "caramel cake",
      similarity: 0.65,
      rating: 4.4,
      ratingCount: 1600,
      lat: -29.85,
      lng: 31.01,
      address: "Essenwood, Berea, 4001",
      breakfast: null,
    }),
  ];

  const plan: PlannerPlan = {
    version: "v2",
    intent: "dining",
    goal: {
      primary: "find_breakfast",
      description: "Best breakfast near me in Ballito",
    },
    workflow: "restaurants",
    confidence: 0.9,
    entities: {
      ...emptyEntityModel(),
      cuisines: ["breakfast"],
    },
    constraints: {
      ...emptyConstraintModel(),
      preferred: {
        ...emptyConstraintModel().preferred,
        breakfast: true,
      },
    },
    missingInformation: [],
    needsClarification: false,
    clarificationQuestion: null,
    executionPlan: [],
    llmRequired: true,
    responseMode: "execute_and_explain",
    locationRef: {
      kind: "location",
      label: "Ballito",
      lat: origin.lat,
      lng: origin.lng,
      source: "turn",
    },
    composition: defaultCompositionRequest("ranked_list"),
    diagnostics: {
      extractorConfidence: 0.9,
      rejectedWorkflows: [],
      rulesApplied: ["infer_breakfast"],
      stickyEntitiesUsed: false,
    },
  };

  const ranked = rankBusinesses(candidates, plan, {
    similarity: 0.38,
    rating: 0.12,
    popularity: 0.08,
    typeBoost: 0.1,
    attributeBoost: 0.12,
    keywordBoost: 0.12,
    quality: 0.05,
    distance: 0.15,
    price: 0.05,
    preferVariety: false,
    limit: 8,
  });

  const ids = ranked.map((b) => b.id);
  assert(ids.includes("catia"), "Catia kept");
  assert(ids.includes("concha"), "Concha kept");
  assert(!ids.includes("bread"), `Berea bakery excluded, got ${ids.join(",")}`);
  assert(!ids.includes("cake"), `cake shop excluded, got ${ids.join(",")}`);
  assert(!ids.includes("stand"), `coffee stand excluded, got ${ids.join(",")}`);
  assert(!ids.includes("steers"), `Steers excluded, got ${ids.join(",")}`);
  assert(!ids.includes("checkers"), `Checkers excluded, got ${ids.join(",")}`);
  assert(!ids.includes("hotel"), `hotel excluded, got ${ids.join(",")}`);
  assert(!ids.includes("kuta"), `lunch-only excluded, got ${ids.join(",")}`);
  assert(!ids.includes("moz"), `Mozambik excluded, got ${ids.join(",")}`);
  assert(
    ranked[0]!.id === "catia" ||
      ranked[0]!.id === "concha" ||
      ranked[0]!.id === "grand",
    `breakfast cafe should lead, got ${ranked[0]!.name}`,
  );
}

console.log("smoke-breakfast-relevance: ok");
