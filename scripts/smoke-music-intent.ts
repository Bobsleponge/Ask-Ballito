/**
 * Offline smoke: guitar / music asks fail closed (no auto/tyre padding).
 * Run: npx tsx scripts/smoke-music-intent.ts
 */
import assert from "node:assert/strict";
import {
  extractMusicLabel,
  filterMusicSpecialists,
  isMusicInstrumentAsk,
  isMusicSpecialist,
  musicEmptyMessage,
} from "../src/services/planner/music-intent";
import { resolveServicesVerticalHint } from "../src/services/planner/service-vertical";
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

assert.equal(isMusicInstrumentAsk("i need to restring my guitar"), true);
assert.equal(extractMusicLabel("i need to restring my guitar"), "guitar restringing");
assert.equal(
  resolveServicesVerticalHint("i need to restring my guitar"),
  "music-instruments",
);

const pool = [
  biz("auto1", "Prestige Auto Ballito (Panel & Paint)", {
    category: "Car repair and maintenance service",
    verticals: ["panel-beaters", "automotive"],
  }),
  biz("tyre1", "Tiger Wheel & Tyre Ballito", {
    category: "Tire Shop",
    verticals: ["tyres"],
  }),
  biz("music1", "Ballito Music Hub", {
    category: "Musical instrument store",
    description: "guitar restringing and lessons",
    verticals: ["music-instruments"],
  }),
];

assert.equal(isMusicSpecialist(pool[2]!), true);
assert.equal(isMusicSpecialist(pool[0]!), false);
assert.deepEqual(
  filterMusicSpecialists(pool).map((b) => b.id),
  ["music1"],
);
assert.ok(musicEmptyMessage("guitar restringing").includes("guitar restringing"));

const city = CITIES.find((c) => c.slug === "ballito") ?? CITIES[0]!;
const draft: PlannerDraft = {
  intent: "service",
  goal: { primary: "services", description: "restring my guitar" },
  candidateWorkflows: ["activities", "services", "general"],
  entities: emptyEntityModel(),
  constraints: emptyConstraintModel(),
  draftQueries: [],
  planFacets: [],
  confidence: 0.7,
  notes: null,
};

const plan = resolvePlannerPlan(
  draft,
  buildConversationContext({ city, history: [] }),
  "i need to restring my guitar",
);

assert.equal(plan.workflow, "services");
assert.equal(plan.composition.strategy, "ranked_list");
assert.ok(
  plan.executionPlan.every(
    (s) => s.params?.verticalHint === "music-instruments",
  ),
);
assert.ok(!/Ideas by vibe/i.test(plan.composition.titleHint ?? ""));

console.log("smoke-music-intent: ok");
