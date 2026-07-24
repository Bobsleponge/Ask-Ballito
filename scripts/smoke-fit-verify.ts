/**
 * Smoke: fit-verify gate + apply decisions (no live OpenAI).
 * Run: npx tsx scripts/smoke-fit-verify.ts
 */
import assert from "node:assert/strict";
import { shouldFitVerify } from "../src/services/ai/fit-verify-gate";
import { applyFitVerifyDecisions } from "../src/services/ai/fit-verify-apply";
import type { ExperienceComposition } from "../src/services/composition/types";
import type { PlannerPlan } from "../src/services/planner/types";
import {
  emptyConstraintModel,
  emptyEntityModel,
} from "../src/services/planner/types";
import { defaultCompositionRequest } from "../src/services/composition/types";
import type { BusinessResult } from "../src/lib/schemas/business";

function biz(
  partial: Partial<BusinessResult> & { id: string; name: string },
): BusinessResult {
  return {
    category: null,
    description: null,
    address: null,
    phone: null,
    website: null,
    rating: 4.5,
    ratingCount: 10,
    priceLevel: null,
    lat: null,
    lng: null,
    photos: [],
    metadata: {},
    ...partial,
  };
}

function stubPlan(
  overrides: {
    workflow?: PlannerPlan["workflow"];
    composition?: Partial<PlannerPlan["composition"]>;
  } = {},
): PlannerPlan {
  const baseComp = defaultCompositionRequest(
    overrides.composition?.strategy ?? "grouped_sections",
  );
  return {
    version: "v2",
    intent: "test",
    goal: { primary: "test", description: "test" },
    workflow: overrides.workflow ?? "restaurants",
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
    diagnostics: {
      extractorConfidence: 0.8,
      rejectedWorkflows: [],
      rulesApplied: [],
      stickyEntitiesUsed: false,
    },
    composition: {
      ...baseComp,
      ...overrides.composition,
    },
  };
}

let passed = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ok  ${name}`);
    passed += 1;
  } catch (err) {
    console.error(`  FAIL  ${name}`);
    throw err;
  }
}

console.log("Fit-verify smoke\n");

const sushiBiz = [
  biz({ id: "s1", name: "Sushi One", category: "Sushi restaurant" }),
  biz({ id: "s2", name: "Sushi Two", category: "Sushi restaurant" }),
  biz({ id: "s3", name: "Sushi Three", category: "Sushi restaurant" }),
];

const sushiComp: ExperienceComposition = {
  strategy: "ranked_list",
  title: "Sushi",
  sections: [
    {
      id: "list",
      title: "Top matches",
      subtitle: null,
      kind: "list",
      businessIds: ["s1", "s2", "s3"],
    },
  ],
  businesses: sushiBiz,
};

check("gate skips basic sushi ranked list", () => {
  const gate = shouldFitVerify({
    userMessage: "Best sushi in Ballito",
    plan: stubPlan({
      workflow: "restaurants",
      composition: {
        strategy: "ranked_list",
        bucketProfile: undefined,
        planFacets: [],
      },
    }),
    composition: sushiComp,
  });
  assert.equal(gate.run, false);
  assert.ok(
    gate.reason === "simple_ranked_list" ||
      gate.reason === "not_multi_need" ||
      gate.reason === "default_skip",
  );
});

check("gate runs for breakfast meal-time ranked list", () => {
  const breakfastBiz = [
    biz({ id: "b1", name: "Concha", category: "Cafe" }),
    biz({ id: "b2", name: "Catia's Cafe", category: "Restaurant" }),
    biz({ id: "b3", name: "Steers", category: "Hamburger Restaurant" }),
    biz({ id: "b4", name: "Checkers", category: "Supermarket" }),
  ];
  const breakfastComp: ExperienceComposition = {
    strategy: "ranked_list",
    title: "Breakfast",
    sections: [
      {
        id: "list",
        title: "Breakfast nearby",
        subtitle: null,
        kind: "list",
        businessIds: ["b1", "b2", "b3", "b4"],
      },
    ],
    businesses: breakfastBiz,
  };
  const gate = shouldFitVerify({
    userMessage: "Best breakfast near me in Ballito",
    plan: stubPlan({
      workflow: "restaurants",
      composition: {
        strategy: "ranked_list",
        bucketProfile: undefined,
        planFacets: [],
      },
    }),
    composition: breakfastComp,
  });
  assert.equal(gate.run, true);
  assert.equal(gate.reason, "meal_time_breakfast");
});

check("gate skips plumber exact ask", () => {
  const gate = shouldFitVerify({
    userMessage: "Plumber for a burst pipe",
    plan: stubPlan({ workflow: "services" }),
    composition: sushiComp,
  });
  assert.equal(gate.run, false);
  assert.equal(gate.reason, "exact_lexical_path");
});

const houseFacets = [
  { id: "catering", label: "Catering", searchQuery: "mobile caterer", verticalHint: null },
  { id: "supplies", label: "Party Supplies", searchQuery: "party supplies", verticalHint: null },
  { id: "entertainment", label: "Entertainment", searchQuery: "DJ hire", verticalHint: null },
];

const houseComp: ExperienceComposition = {
  strategy: "grouped_sections",
  title: "Plan for a house party",
  sections: [
    {
      id: "facet_catering",
      title: "Catering",
      subtitle: null,
      kind: "list",
      businessIds: ["guest1", "cater1"],
    },
    {
      id: "facet_supplies",
      title: "Party Supplies",
      subtitle: null,
      kind: "list",
      businessIds: ["supply1"],
    },
    {
      id: "facet_entertainment",
      title: "Entertainment",
      subtitle: null,
      kind: "list",
      businessIds: ["dj1"],
    },
  ],
  businesses: [
    biz({
      id: "guest1",
      name: "The Boathouse Luxury Guest House",
      category: "Guest House",
      description: "spa restaurant",
      metadata: { planFacetId: "catering" },
    }),
    biz({
      id: "cater1",
      name: "Ballito Platters Mobile",
      category: "Caterer",
      description: "mobile catering platters delivery",
      metadata: { planFacetId: "catering" },
    }),
    biz({
      id: "supply1",
      name: "Whitehouse Ballito",
      category: "Home Goods Store",
      metadata: { planFacetId: "supplies" },
    }),
    biz({
      id: "dj1",
      name: "Coast DJ Hire",
      category: "Entertainment",
      description: "DJ hire for parties",
      metadata: { planFacetId: "entertainment" },
    }),
  ],
};

check("gate runs for house party multi facets", () => {
  const gate = shouldFitVerify({
    userMessage: "i am having a house party on saturday",
    plan: stubPlan({
      workflow: "special_occasion",
      composition: {
        strategy: "grouped_sections",
        bucketProfile: "plan_facets",
        planFacets: houseFacets,
      },
    }),
    composition: houseComp,
  });
  assert.equal(gate.run, true);
  assert.equal(gate.reason, "multi_plan_facets");
});

check("apply decisions drops guesthouse keeps caterer", () => {
  const next = applyFitVerifyDecisions(
    houseComp,
    {
      decisions: [
        { businessId: "guest1", action: "drop", facetId: null, reason: "venue" },
        { businessId: "cater1", action: "keep", facetId: null, reason: null },
        { businessId: "supply1", action: "keep", facetId: null, reason: null },
        { businessId: "dj1", action: "keep", facetId: null, reason: null },
      ],
    },
    houseFacets,
  );
  const ids = next.businesses.map((b) => b.id).sort();
  assert.deepEqual(ids, ["cater1", "dj1", "supply1"]);
  assert.ok(!ids.includes("guest1"));
  const catering = next.sections.find((s) => s.title === "Catering");
  assert.ok(catering);
  assert.deepEqual(catering!.businessIds, ["cater1"]);
});

check("gate skips tiny composition", () => {
  const gate = shouldFitVerify({
    userMessage: "house party",
    plan: stubPlan({
      workflow: "special_occasion",
      composition: {
        bucketProfile: "plan_facets",
        planFacets: houseFacets,
      },
    }),
    composition: {
      ...houseComp,
      businesses: houseComp.businesses.slice(0, 2),
      sections: [
        {
          id: "facet_catering",
          title: "Catering",
          subtitle: null,
          kind: "list",
          businessIds: ["guest1", "cater1"],
        },
      ],
    },
  });
  assert.equal(gate.run, false);
  assert.equal(gate.reason, "too_few_businesses");
});

check("apply can drop casual dining on adult milestone ask", () => {
  const dinnerFacets = [
    {
      id: "dinner",
      label: "Birthday dinner",
      searchQuery: "special occasion dinner",
      verticalHint: "restaurants",
    },
    {
      id: "drinks",
      label: "Cocktails",
      searchQuery: "cocktail bar",
      verticalHint: "nightlife",
    },
  ];
  const milestoneComp: ExperienceComposition = {
    strategy: "grouped_sections",
    title: "Plan the celebration",
    sections: [
      {
        id: "facet_dinner",
        title: "Birthday dinner",
        subtitle: null,
        kind: "list",
        businessIds: ["casual1", "nice1"],
      },
      {
        id: "facet_drinks",
        title: "Cocktails",
        subtitle: null,
        kind: "list",
        businessIds: ["bar1"],
      },
    ],
    businesses: [
      biz({
        id: "casual1",
        name: "Bird and Co",
        category: "Casual restaurant",
        priceLevel: 1,
        metadata: { planFacetId: "dinner" },
      }),
      biz({
        id: "nice1",
        name: "Harbour House",
        category: "Seafood restaurant",
        priceLevel: 3,
        metadata: { planFacetId: "dinner" },
      }),
      biz({
        id: "bar1",
        name: "Sky Bar",
        category: "Cocktail bar",
        metadata: { planFacetId: "drinks" },
      }),
    ],
  };
  const next = applyFitVerifyDecisions(
    milestoneComp,
    {
      decisions: [
        {
          businessId: "casual1",
          action: "drop",
          facetId: null,
          reason: "too casual for 40th",
        },
        { businessId: "nice1", action: "keep", facetId: null, reason: null },
        { businessId: "bar1", action: "keep", facetId: null, reason: null },
      ],
    },
    dinnerFacets,
  );
  assert.deepEqual(
    next.businesses.map((b) => b.id).sort(),
    ["bar1", "nice1"],
  );
  const dinner = next.sections.find((s) => s.title === "Birthday dinner");
  assert.deepEqual(dinner?.businessIds, ["nice1"]);
});

console.log(`\n${passed} checks passed.`);
