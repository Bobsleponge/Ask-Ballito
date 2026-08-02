/**
 * Offline smoke: car battery / auto-parts asks retrieve parts + tyre shops,
 * not generic mechanics alone.
 * Run: npm run smoke:auto-parts
 */
import assert from "node:assert/strict";
import {
  autoPartsEmptyMessage,
  extractAutoPartsLabel,
  filterAutoPartsSpecialists,
  isAutoPartsAsk,
} from "../src/services/planner/auto-parts-intent";
import { resolveServicesVerticalHint } from "../src/services/planner/service-vertical";
import { classifyQuery } from "../src/services/classifier/classify";
import { resolvePlannerPlan } from "../src/services/planner/resolver";
import { buildConversationContext } from "../src/services/planner/context";
import {
  emptyConstraintModel,
  emptyEntityModel,
  type PlannerDraft,
} from "../src/services/planner/types";
import type { BusinessResult } from "../src/lib/schemas/business";
import { CITIES } from "../src/config/cities";
import { allowlistForHint } from "../src/config/vertical-policy";
import { filterByVerticalHint } from "../src/lib/business-vertical-filter";

function biz(
  id: string,
  name: string,
  opts: { category?: string; description?: string; verticals?: string[] } = {},
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
    ratingCount: 20,
    priceLevel: null,
    lat: null,
    lng: null,
    photos: [],
    metadata: opts.verticals ? { verticals: opts.verticals } : {},
  };
}

const q = "i need a car battery";

assert.equal(isAutoPartsAsk(q), true);
assert.equal(extractAutoPartsLabel(q), "car battery");
assert.equal(resolveServicesVerticalHint(q), "auto-parts");
assert.deepEqual(allowlistForHint("auto-parts"), ["auto-parts", "tyres"]);

const classification = classifyQuery({ message: q, citySlug: "ballito" });
assert.equal(classification.queryClass, "BUSINESS_SEARCH");
assert.ok(classification.signals.includes("auto_parts"));

const pool = [
  biz("tyre1", "Tiger Wheel & Tyre Ballito", {
    category: "Tire Shop",
    verticals: ["tyres"],
  }),
  biz("mech1", "Ballito Auto Service Centre", {
    category: "Car repair and maintenance service",
    description: "oil change and services",
    verticals: ["automotive"],
  }),
  biz("parts1", "Car Spares Ballito", {
    category: "Auto Parts Store",
    description: "motor spares and batteries",
    verticals: ["auto-parts"],
  }),
  biz("parts2", "Max Motor Spares Ballito", {
    category: "Auto Parts Store",
    verticals: ["auto-parts"],
  }),
  // Amenity schema keys must not false-reject (e.g. "massage": null).
  {
    ...biz("parts3", "National Motor Spares Ballito", {
      category: "Auto Parts Store",
      verticals: ["auto-parts"],
    }),
    metadata: {
      verticals: ["auto-parts"],
      types: ["auto_parts_store"],
      massage: null,
      spa: null,
      cafe: null,
    },
  },
  biz("cafe1", "Ballito Beach Cafe", {
    category: "Cafe",
    verticals: ["cafes"],
  }),
];

const afterHint = filterByVerticalHint(pool, "auto-parts");
assert.ok(afterHint.some((b) => b.id === "parts1"));
assert.ok(afterHint.some((b) => b.id === "tyre1"));
assert.ok(!afterHint.some((b) => b.id === "mech1"));
assert.ok(!afterHint.some((b) => b.id === "cafe1"));

const fitted = filterAutoPartsSpecialists(afterHint);
assert.ok(fitted.some((b) => /spares/i.test(b.name)));
assert.ok(fitted.some((b) => /tyre/i.test(b.name)));
assert.ok(
  fitted.some((b) => b.id === "parts3"),
  "amenity null keys must not reject parts shops",
);
assert.ok(!fitted.some((b) => b.id === "mech1"));

const city = CITIES.find((c) => c.slug === "ballito") ?? CITIES[0]!;
const draft: PlannerDraft = {
  intent: "service",
  goal: { primary: "find_car_battery", description: q },
  confidence: 0.9,
  candidateWorkflows: ["services"],
  entities: emptyEntityModel(),
  constraints: emptyConstraintModel(),
  draftQueries: [],
  planFacets: [],
  notes: "",
};
const ctx = buildConversationContext({
  city,
  history: [],
  stickySummary: null,
});
const plan = resolvePlannerPlan(draft, ctx, q);
assert.equal(plan.workflow, "services");
assert.ok(
  plan.diagnostics.rulesApplied.some((r) => /auto_parts/.test(r)),
);
assert.ok(
  plan.executionPlan.every(
    (step) => step.params?.verticalHint === "auto-parts",
  ),
  "execution must hint auto-parts, not automotive",
);
assert.equal(plan.composition.titleHint, "car battery");
assert.match(autoPartsEmptyMessage("car battery"), /auto-parts \/ battery/i);

console.log("smoke-auto-parts-intent: ok");
