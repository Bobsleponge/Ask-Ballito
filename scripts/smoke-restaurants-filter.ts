/**
 * Offline smoke: restaurants workflow must exclude non-dining junk
 * and not vibe-bucket dentists into Family-friendly.
 * Run: npx tsx scripts/smoke-restaurants-filter.ts
 */
import assert from "node:assert/strict";
import {
  filterByVerticalHint,
  isDiningBusiness,
  matchesVerticalHint,
  verticalIntentScore,
} from "../src/lib/business-vertical-filter";
import { diningBucket } from "../src/services/composition/strategies/dining-buckets";
import { rankBusinesses } from "../src/services/ai/ranking.engine";
import type { BusinessResult } from "../src/lib/schemas/business";
import type { PlannerPlan } from "../src/services/planner/types";
import {
  emptyConstraintModel,
  emptyEntityModel,
} from "../src/services/planner/types";
import { defaultCompositionRequest } from "../src/services/composition/types";

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
    address: null,
    phone: null,
    website: null,
    rating: opts.rating ?? 4.5,
    ratingCount: opts.ratingCount ?? 200,
    priceLevel: opts.priceLevel ?? 2,
    lat: null,
    lng: null,
    photos: [],
    similarity: opts.similarity ?? 0.7,
    score: opts.score,
    metadata: opts.metadata ?? {},
  };
}

const junk = [
  biz("d1", "Family Dental Care - Ballito", {
    category: "Dentist",
    ratingCount: 520,
    metadata: { verticals: ["dentists"] },
  }),
  biz("m1", "Ballito Lifestyle Centre", {
    category: "Shopping Mall",
    ratingCount: 13100,
    metadata: { verticals: ["shopping"] },
  }),
  biz("g1", "The Boathouse Luxury Guest House", {
    category: "Guest House",
    ratingCount: 508,
    metadata: { verticals: ["hotels"] },
  }),
  biz("s1", "Checkers Foods Ballito Steps", {
    category: "Supermarket",
    ratingCount: 494,
    metadata: { verticals: ["grocery"] },
  }),
  biz("p1", "Bambini Land", {
    category: "Playground",
    ratingCount: 18,
    metadata: { verticals: ["family"] },
  }),
  biz("l1", "Ballito Lasertag", {
    category: "Laser Tag",
    ratingCount: 2,
    metadata: { verticals: ["attractions"] },
  }),
];

const dining = [
  biz("r1", "45 on Eat Street", {
    category: "Fine Dining Restaurant",
    priceLevel: 3,
    rating: 4.6,
    ratingCount: 1200,
    metadata: { verticals: ["restaurants"] },
  }),
  biz("r2", "Polipetto Seafood Restaurant & Sushi Bar", {
    category: "Restaurant",
    rating: 4.7,
    ratingCount: 498,
    metadata: { verticals: ["restaurants"] },
  }),
  biz("r3", "Kuta-Kola", {
    category: "Restaurant",
    rating: 4.6,
    ratingCount: 928,
    metadata: { verticals: ["restaurants"], attributes: { seaView: true } },
  }),
  biz("q1", "Steers Ballito Junction", {
    category: "Hamburger Restaurant",
    priceLevel: 1,
    rating: 4.7,
    ratingCount: 644,
    metadata: { verticals: ["restaurants", "takeaways"] },
  }),
  biz("q2", "RocoMamas Ballito Junction", {
    category: "Hamburger Restaurant",
    priceLevel: 2,
    rating: 4.3,
    ratingCount: 979,
    metadata: { verticals: ["restaurants"] },
  }),
];

let failed = 0;
function check(label: string, fn: () => void) {
  try {
    fn();
    console.log(`ok  ${label}`);
  } catch (e) {
    failed += 1;
    console.error(`FAIL ${label}`);
    console.error(e);
  }
}

check("junk fails matchesVerticalHint(restaurants)", () => {
  for (const b of junk) {
    assert.equal(
      matchesVerticalHint(b, "restaurants"),
      false,
      `${b.name} should not match restaurants`,
    );
    assert.equal(isDiningBusiness(b), false, `${b.name} not dining`);
    assert.equal(verticalIntentScore(b, "restaurants"), 0);
  }
});

check("filterByVerticalHint drops junk", () => {
  const filtered = filterByVerticalHint([...junk, ...dining], "restaurants");
  const names = filtered.map((b) => b.name);
  assert.ok(names.includes("45 on Eat Street"));
  assert.ok(!names.some((n) => /Dental|Lifestyle Centre|Guest House|Checkers|Bambini|Lasertag/i.test(n)));
});

check("diningBucket never family-buckets dentist", () => {
  assert.equal(diningBucket(junk[0]!), null);
  assert.equal(diningBucket(dining[0]!), "Fine dining");
  assert.equal(diningBucket(dining[2]!), "Sea views");
});

check("best restaurants rank demotes Steers below fine dining", () => {
  const plan: PlannerPlan = {
    version: "v2",
    intent: "best restaurants",
    goal: { primary: "find_restaurant", description: "Best restaurants in Ballito" },
    workflow: "restaurants",
    confidence: 0.9,
    entities: emptyEntityModel(),
    constraints: emptyConstraintModel(),
    missingInformation: [],
    needsClarification: false,
    clarificationQuestion: null,
    executionPlan: [
      {
        id: "s1",
        capability: "business_search",
        type: "business_search",
        query: "best restaurants in Ballito",
        params: { verticalHint: "restaurants" },
        priority: 1,
        optional: false,
      },
    ],
    llmRequired: true,
    responseMode: "execute_and_explain",
    locationRef: null,
    composition: defaultCompositionRequest("grouped_sections"),
    diagnostics: {
      extractorConfidence: 0.9,
      rejectedWorkflows: [],
      rulesApplied: [],
      stickyEntitiesUsed: false,
    },
  };

  const ranked = rankBusinesses([...dining, ...junk], plan, {
    verticalHint: "restaurants",
    preferVariety: false,
    minKeep: 0,
    limit: 10,
  });
  const names = ranked.map((b) => b.name);
  assert.ok(
    !names.some((n) => /Dental|Lifestyle Centre|Guest House|Checkers|Bambini|Lasertag/i.test(n)),
    `junk leaked: ${names.join(", ")}`,
  );
  const steers = ranked.find((b) => /Steers/i.test(b.name));
  const fine = ranked.find((b) => /45 on Eat/i.test(b.name));
  assert.ok(fine, "fine dining present");
  if (steers) {
    assert.ok(
      (fine!.score ?? 0) > (steers.score ?? 0),
      `Steers (${steers.score}) should score below 45 (${fine!.score})`,
    );
  }
});

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log("\nAll restaurant filter smoke checks passed.");
