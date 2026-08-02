/**
 * Offline smoke: PPF / wrap / tint / detailing asks fail closed (no tyre/mechanic padding).
 * Run: npm run smoke:auto-protection
 */
import assert from "node:assert/strict";
import {
  autoProtectionEmptyMessage,
  extractAutoProtectionLabel,
  filterAutoProtectionSpecialists,
  isAutoProtectionAsk,
  isAutoProtectionSpecialist,
} from "../src/services/planner/auto-protection-intent";
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

const q = "i need PPF for my car";

assert.equal(isAutoProtectionAsk(q), true);
assert.equal(extractAutoProtectionLabel(q), "paint protection film (PPF)");
assert.equal(resolveServicesVerticalHint(q), "automotive");

const classification = classifyQuery({ message: q, citySlug: "ballito" });
assert.equal(classification.queryClass, "BUSINESS_SEARCH");
assert.ok(classification.signals.includes("auto_protection"));
assert.ok(
  classification.draftQueries.some((d) => /ppf|paint protection/i.test(d)),
);

const pool = [
  biz("tyre1", "Tiger Wheel & Tyre Ballito", {
    category: "Tire Shop",
    verticals: ["tyres", "automotive"],
  }),
  biz("mech1", "Ballito Auto Service Centre", {
    category: "Car repair and maintenance service",
    description: "oil change and services",
    verticals: ["automotive"],
  }),
  biz("ppf1", "Ballito PPF & Ceramic Studio", {
    category: "Auto detailing",
    description: "paint protection film PPF ceramic coating and car wraps",
    verticals: ["automotive"],
  }),
  biz("wrap1", "North Coast Vinyl Wraps", {
    category: "Vehicle wrapping service",
    description: "vehicle wraps and window tint",
    verticals: ["automotive"],
  }),
];

assert.equal(isAutoProtectionSpecialist(pool[2]!), true);
assert.equal(isAutoProtectionSpecialist(pool[3]!), true);
assert.equal(isAutoProtectionSpecialist(pool[0]!), false);
assert.equal(isAutoProtectionSpecialist(pool[1]!), false);
assert.deepEqual(
  filterAutoProtectionSpecialists(pool).map((b) => b.id).sort(),
  ["ppf1", "wrap1"],
);
assert.ok(
  autoProtectionEmptyMessage("paint protection film (PPF)").includes("PPF"),
);

const city = CITIES.find((c) => c.slug === "ballito") ?? CITIES[0]!;
const draft: PlannerDraft = {
  intent: "service",
  goal: { primary: "find_ppf", description: q },
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
  plan.diagnostics.rulesApplied.some((r) => /auto_protection/.test(r)),
);
assert.ok(plan.executionPlan.some((s) => /ppf|paint|wrap|tint|detail/i.test(s.query)));
assert.equal(plan.composition.titleHint, "paint protection film (PPF)");

console.log("smoke-auto-protection-intent: ok");
