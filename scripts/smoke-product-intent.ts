/**
 * Offline smoke: product / buy asks stay on shopping relevance (no pets/lasertag).
 *
 * Run: npx tsx scripts/smoke-product-intent.ts
 */
import assert from "node:assert/strict";
import {
  extractProductLabel,
  isProductPurchaseAsk,
  productEmptyMessage,
  productSearchQueries,
} from "../src/services/planner/product-intent";
import {
  enforceProductAskFit,
  filterProductSpecialists,
  filterShoppingMalls,
  isElectronicsSpecialist,
  isRejectedForProductAsk,
  isShoppingMall,
} from "../src/services/planner/shopping-relevance";
import { buildCompositionRequest } from "../src/services/composition/request";
import { resolvePlannerPlan } from "../src/services/planner/resolver";
import { buildConversationContext } from "../src/services/planner/context";
import {
  emptyConstraintModel,
  emptyEntityModel,
  type PlannerDraft,
} from "../src/services/planner/types";
import type { BusinessResult } from "../src/lib/schemas/business";
import { CITIES } from "../src/config/cities";

function biz(
  id: string,
  name: string,
  opts: {
    category?: string;
    description?: string;
    verticals?: string[];
  } = {},
): BusinessResult {
  return {
    id,
    name,
    category: opts.category ?? null,
    description: opts.description ?? null,
    address: null,
    phone: null,
    website: null,
    rating: 4.5,
    ratingCount: 40,
    priceLevel: null,
    lat: null,
    lng: null,
    photos: [],
    metadata: {
      ...(opts.verticals ? { verticals: opts.verticals } : {}),
    },
  };
}

const pool: BusinessResult[] = [
  biz("pet1", "Ballito Pet Emporium", {
    category: "Pet store",
    description: "dog food and grooming",
    verticals: ["shopping"],
  }),
  biz("laser1", "North Coast Lasertag", {
    category: "Amusement center",
    description: "laser tag arena",
    verticals: ["attractions"],
  }),
  biz("bake1", "Salt Rock Bakery", {
    category: "Bakery",
    description: "fresh bread and cakes",
    verticals: ["bakeries"],
  }),
  biz("auto1", "Ballito Auto Fix", {
    category: "Car repair",
    description: "servicing and repairs",
    verticals: ["automotive"],
  }),
  biz("elec1", "Incredible Connection Ballito", {
    category: "Electronics store",
    description: "laptops gaming gear phones headphones",
    verticals: ["shopping"],
  }),
  biz("comp1", "Ballito Computer Shop", {
    category: "Computer store",
    description: "PC builds keyboards mice repairs",
    verticals: ["shopping"],
  }),
  biz("mall1", "Ballito Junction", {
    category: "Shopping mall",
    description: "lifestyle shopping centre with retail",
    verticals: ["shopping"],
  }),
];

assert.equal(isProductPurchaseAsk("where can I buy a gaming mouse in Ballito?"), true);
assert.equal(isProductPurchaseAsk("gaming mouse Ballito"), true);
assert.equal(isProductPurchaseAsk("need a laptop charger"), true);
assert.equal(isProductPurchaseAsk("best brunch with kids"), false);
assert.equal(isProductPurchaseAsk("24 hour plumber"), false);

assert.equal(extractProductLabel("where can I buy a gaming mouse"), "gaming mouse");
assert.equal(extractProductLabel("need a laptop"), "laptop");

assert.ok(productSearchQueries("gaming mouse", "Ballito").some((q) => /electronics/i.test(q)));
assert.ok(productEmptyMessage("gaming mouse").includes("gaming mouse"));

assert.equal(isRejectedForProductAsk(pool[0]!), true);
assert.equal(isElectronicsSpecialist(pool[4]!), true);
assert.equal(isElectronicsSpecialist(pool[0]!), false);
assert.equal(isShoppingMall(pool[6]!), true);
assert.equal(isShoppingMall(pool[4]!), false);

const specialists = filterProductSpecialists(pool);
assert.deepEqual(
  specialists.map((b) => b.id).sort(),
  ["comp1", "elec1"],
);

const malls = filterShoppingMalls(pool);
assert.deepEqual(
  malls.map((b) => b.id),
  ["mall1"],
);

assert.deepEqual(
  enforceProductAskFit(pool, "exact").map((b) => b.id).sort(),
  ["comp1", "elec1"],
);
assert.deepEqual(
  enforceProductAskFit(pool, "related").map((b) => b.id),
  ["mall1"],
);

const city = CITIES.find((c) => c.slug === "ballito") ?? CITIES[0]!;
const context = buildConversationContext({ city, history: [] });

const draft: PlannerDraft = {
  intent: "buy_product",
  goal: {
    primary: "shopping",
    description: "where can I buy a gaming mouse in Ballito",
  },
  candidateWorkflows: ["activities", "general"],
  entities: emptyEntityModel(),
  constraints: emptyConstraintModel(),
  draftQueries: [],
  planFacets: [],
  confidence: 0.7,
  notes: null,
};

const plan = resolvePlannerPlan(
  draft,
  context,
  "where can I buy a gaming mouse in Ballito?",
);

assert.notEqual(plan.workflow, "activities");
assert.equal(plan.composition.strategy, "ranked_list");
assert.ok(
  plan.executionPlan.every(
    (s) => s.params?.verticalHint === "shopping" || s.type === "business_search",
  ),
);
assert.ok(
  plan.executionPlan.some((s) => s.params?.verticalHint === "electronics"),
  "product asks must search electronics vertical",
);
assert.ok(
  plan.diagnostics.rulesApplied.some(
    (r) =>
      r === "force_general_for_product_ask" ||
      r === "product_purchase_ask" ||
      r === "product_execution_electronics",
  ),
);

assert.ok(
  productSearchQueries("gaming mouse", "Ballito").some((q) =>
    /Incredible Connection/i.test(q),
  ),
);
assert.ok(
  productSearchQueries("gaming mouse", "Ballito").some((q) =>
    /Matrix Warehouse/i.test(q),
  ),
);

const matrix = biz("matrix1", "Matrix Warehouse Ballito", {
  category: "Electronics store",
  description: "computers and gaming",
  verticals: ["electronics"],
});
const gameStore = biz("game1", "Game Ballito Junction", {
  category: "Electronics store",
  description: "gaming consoles and accessories",
  verticals: ["electronics"],
});
assert.equal(isElectronicsSpecialist(matrix), true);
assert.equal(isElectronicsSpecialist(gameStore), true);
assert.ok(
  filterProductSpecialists([...pool, matrix, gameStore])
    .map((b) => b.id)
    .includes("matrix1"),
);

const { request, rules } = buildCompositionRequest({
  goalPrimary: "shopping",
  goalDescription: "gaming mouse",
  intent: "where can I buy a gaming mouse",
  workflowId: "activities",
  defaultStrategy: "grouped_sections",
  entities: draft.entities,
  constraints: draft.constraints,
  locationRef: null,
});
assert.equal(request.strategy, "ranked_list");
assert.ok(rules.includes("composition_product_ranked"));

console.log("smoke-product-intent: ok");
