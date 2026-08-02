/**
 * Smoke: dynamic celebration facets (not hard-coded proposal checklist).
 * Run: npx tsx scripts/smoke-special-occasion.ts
 */
import assert from "node:assert/strict";
import {
  celebrationTitleHint,
  enrichCelebrationFacets,
  executionPlanFromFacets,
  filterCelebrationAudienceNoise,
  filterElevatedCasualDining,
  filterPlanFacetVerticalFit,
  isAdultDowntimeAsk,
  isAdultMilestoneAsk,
  isCelebrationAsk,
  isDiningPlanFacet,
  isElevatedCelebrationAsk,
  isKidsCelebrationAsk,
  isProposalAsk,
  sanitizePlanFacets,
  CELEBRATION_SECTION_ITEM_CAP,
  CELEBRATION_SECTION_ITEM_MIN,
} from "../src/services/planner/special-occasion-intent";
import { filterByVerticalHint } from "../src/lib/business-vertical-filter";
import { composePlanFacetSections } from "../src/services/composition/strategies/plan-facets";
import { resolvePlannerPlan } from "../src/services/planner/resolver";
import { buildConversationContext } from "../src/services/planner/context";
import {
  emptyConstraintModel,
  emptyEntityModel,
  type PlanFacet,
  type PlannerDraft,
  type PlannerPlan,
} from "../src/services/planner/types";
import type { BusinessResult } from "../src/lib/schemas/business";
import { CITIES } from "../src/config/cities";
import { defaultCompositionRequest } from "../src/services/composition/types";
import { rankBusinesses } from "../src/services/ai/ranking.engine";
import { specialOccasionDefinition } from "../src/services/workflows/definitions/special-occasion";

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

const city = CITIES.find((c) => c.slug === "ballito") ?? CITIES[0]!;
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

const kidsFacets: PlanFacet[] = [
  {
    id: "party_venues",
    label: "Party venues & play",
    searchQuery: "kids party venues soft play laser tag Sugar Rush",
    verticalHint: "family",
  },
  {
    id: "cake",
    label: "Birthday cake",
    searchQuery: "birthday cake bakery Ballito",
    verticalHint: "bakeries",
  },
  {
    id: "family_meal",
    label: "Family meal",
    searchQuery: "family friendly restaurants kids",
    verticalHint: "restaurants",
  },
];

const proposalFacets: PlanFacet[] = [
  {
    id: "rings",
    label: "Engagement rings",
    searchQuery: "engagement rings jewellers",
    verticalHint: "jewellery",
  },
  {
    id: "flowers",
    label: "Flowers",
    searchQuery: "florist bouquet proposal",
    verticalHint: "florists",
  },
  {
    id: "dinner",
    label: "Celebrate afterwards",
    searchQuery: "romantic restaurant sea view",
    verticalHint: "restaurants",
  },
];

console.log("Celebration facets smoke\n");

check("detects celebration vs dinner-only", () => {
  assert.equal(isCelebrationAsk("I am going to propose to my wife"), true);
  assert.equal(isKidsCelebrationAsk("its my kids birthday on monday"), true);
  assert.equal(isCelebrationAsk("romantic dinner tonight"), false);
});

check("kids facets drive execution — no jewellery step", () => {
  const steps = executionPlanFromFacets(sanitizePlanFacets(kidsFacets));
  assert.equal(steps.length, 3);
  assert.ok(steps.every((s) => !/jewell|ring/i.test(s.query)));
  assert.equal(steps[0]?.params.planFacetId, "party_venues");
});

check("proposal facets include jewellery step", () => {
  const steps = executionPlanFromFacets(sanitizePlanFacets(proposalFacets));
  assert.ok(steps.some((s) => s.params.verticalHint === "jewellery"));
});

check("thin proposal LLM facets expand to a full day plan", () => {
  assert.equal(isProposalAsk("Plan my proposal for Friday"), true);
  const thin: PlanFacet[] = [
    {
      id: "dinner",
      label: "Romantic Dinner",
      searchQuery: "romantic dinner Ballito",
      verticalHint: "restaurants",
    },
    {
      id: "flowers",
      label: "Proposal Florist",
      searchQuery: "florist Ballito",
      verticalHint: "florists",
    },
  ];
  const enriched = enrichCelebrationFacets(thin, "Plan my proposal for Friday");
  const hints = enriched.map((f) => f.verticalHint);
  assert.ok(hints.includes("jewellery"), `got ${hints.join(",")}`);
  assert.ok(hints.includes("florists"), `got ${hints.join(",")}`);
  assert.ok(hints.includes("photography"), `got ${hints.join(",")}`);
  assert.ok(hints.includes("attractions"), `got ${hints.join(",")}`);
  assert.ok(hints.includes("restaurants"), `got ${hints.join(",")}`);
  assert.ok(hints.includes("hotels"), `got ${hints.join(",")}`);
  assert.ok(enriched.length >= 5);
  assert.equal(CELEBRATION_SECTION_ITEM_CAP, 9);
  assert.equal(CELEBRATION_SECTION_ITEM_MIN, 3);
  const steps = executionPlanFromFacets(enriched);
  assert.ok(steps.every((s) => (s.params.limit as number) >= 9));
});

check("empty proposal facets get default checklist", () => {
  const enriched = enrichCelebrationFacets([], "I want to propose in Ballito");
  assert.ok(enriched.length >= 5);
  assert.ok(enriched.some((f) => f.verticalHint === "photography"));
  assert.ok(enriched.some((f) => f.verticalHint === "jewellery"));
});

check("resolver uses kids facets — not The ring", () => {
  const draft: PlannerDraft = {
    intent: "kids birthday",
    goal: { primary: "kids_birthday", description: "kids birthday on monday" },
    candidateWorkflows: ["activities", "special_occasion", "general"],
    entities: emptyEntityModel(),
    constraints: emptyConstraintModel(),
    draftQueries: [],
    planFacets: kidsFacets,
    confidence: 0.85,
    notes: null,
  };
  const plan = resolvePlannerPlan(
    draft,
    buildConversationContext({ city, history: [] }),
    "its my kids birthday on monday",
  );
  assert.equal(plan.workflow, "special_occasion");
  assert.equal(plan.composition.bucketProfile, "plan_facets");
  assert.ok(/birthday/i.test(plan.composition.titleHint ?? ""));
  assert.equal(plan.constraints.preferred.familyFriendly, true);
  assert.ok(
    plan.composition.planFacets?.every((f) => !/ring/i.test(f.label)),
  );
  assert.ok(plan.executionPlan.some((s) => s.id === "party_venues"));
  assert.ok(!plan.executionPlan.some((s) => s.params.verticalHint === "jewellery"));
});

check("bare celebration goal without facets falls to activities", () => {
  const draft: PlannerDraft = {
    intent: "celebration",
    goal: { primary: "plan_special_occasion", description: "something special" },
    candidateWorkflows: ["special_occasion", "activities"],
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
    "something nice for a celebration",
  );
  assert.equal(plan.workflow, "activities");
});

check("compose sections from facet provenance", () => {
  const ranked = [
    biz({
      id: "play1",
      name: "Sugar Rush",
      metadata: { planFacetId: "party_venues", verticals: ["family"] },
    }),
    biz({
      id: "cake1",
      name: "Cake Shop",
      metadata: { planFacetId: "cake", verticals: ["bakeries"] },
    }),
    biz({
      id: "jewel1",
      name: "Karat Guy",
      category: "Jewelry store",
      metadata: { verticals: ["jewellery"] },
    }),
  ];
  const request = {
    ...defaultCompositionRequest("grouped_sections"),
    bucketProfile: "plan_facets" as const,
    planFacets: kidsFacets,
    maxSections: 6,
    maxItemsPerSection: 4,
    minItemsPerSection: 1,
  };
  const sections = composePlanFacetSections(ranked, request);
  const titles = sections.map((s) => s.title);
  assert.ok(titles.includes("Party venues & play"));
  assert.ok(titles.includes("Birthday cake"));
  assert.ok(!titles.some((t) => /ring/i.test(t)));
});

check("plan facets omit sections below the min-of-3 rule", () => {
  const facets: PlanFacet[] = [
    {
      id: "flowers",
      label: "Proposal florist",
      searchQuery: "florist",
      verticalHint: "florists",
    },
    {
      id: "dinner",
      label: "Romantic dinner",
      searchQuery: "romantic dinner",
      verticalHint: "restaurants",
    },
  ];
  const ranked = [
    biz({
      id: "f1",
      name: "Fancy Flowers",
      metadata: { planFacetId: "flowers", verticals: ["florists"] },
    }),
    biz({
      id: "d1",
      name: "Dinner One",
      metadata: { planFacetId: "dinner", verticals: ["restaurants"] },
    }),
    biz({
      id: "d2",
      name: "Dinner Two",
      metadata: { planFacetId: "dinner", verticals: ["restaurants"] },
    }),
    biz({
      id: "d3",
      name: "Dinner Three",
      metadata: { planFacetId: "dinner", verticals: ["restaurants"] },
    }),
    biz({
      id: "d4",
      name: "Dinner Four",
      metadata: { planFacetId: "dinner", verticals: ["restaurants"] },
    }),
  ];
  const sections = composePlanFacetSections(ranked, {
    ...defaultCompositionRequest("grouped_sections"),
    bucketProfile: "plan_facets",
    planFacets: facets,
    maxSections: 6,
    maxItemsPerSection: 9,
    // default min is 3 for plan_facets
  });
  assert.ok(!sections.some((s) => s.title === "Proposal florist"));
  const dinner = sections.find((s) => s.title === "Romantic dinner");
  assert.ok(dinner);
  assert.ok(dinner!.businessIds.length >= 3);
  assert.ok(dinner!.businessIds.length <= 9);
});

check("family filter drops jewellers keeps play", () => {
  const kept = filterCelebrationAudienceNoise(
    [
      biz({
        id: "j",
        name: "Ballito Jewellers",
        metadata: { verticals: ["jewellery"] },
      }),
      biz({
        id: "p",
        name: "Sugar Rush Park",
        category: "Theme park",
        description: "kids play",
      }),
    ],
    { familyFriendly: true, kidsAsk: true, facets: kidsFacets },
  );
  assert.deepEqual(
    kept.map((b) => b.id),
    ["p"],
  );
});

check("title hints are occasion-aware", () => {
  assert.ok(/birthday/i.test(celebrationTitleHint("kids birthday monday")));
  assert.ok(/proposal/i.test(celebrationTitleHint("propose to my wife")));
});

check("adult milestone vs kids tone detectors", () => {
  assert.equal(isAdultMilestoneAsk("planning a 40th birthday dinner"), true);
  assert.equal(isElevatedCelebrationAsk("planning a 40th birthday dinner"), true);
  assert.equal(isKidsCelebrationAsk("planning a 40th birthday dinner"), false);
  assert.equal(isAdultMilestoneAsk("its my kids birthday on monday"), false);
  assert.equal(isElevatedCelebrationAsk("its my kids birthday on monday"), false);
  assert.equal(
    isElevatedCelebrationAsk("casual birthday burgers with friends"),
    false,
  );
  assert.equal(isElevatedCelebrationAsk("propose to my wife"), true);
});

check("40th sets upscale budget; kids does not", () => {
  const dinnerFacets: PlanFacet[] = [
    {
      id: "dinner",
      label: "Birthday dinner",
      searchQuery: "special occasion dinner sea view",
      verticalHint: "restaurants",
    },
    {
      id: "drinks",
      label: "Cocktails",
      searchQuery: "cocktail bar Ballito",
      verticalHint: "nightlife",
    },
    {
      id: "cake",
      label: "Cake",
      searchQuery: "birthday cake bakery",
      verticalHint: "bakeries",
    },
  ];
  const adultDraft: PlannerDraft = {
    intent: "40th birthday",
    goal: {
      primary: "plan_special_occasion",
      description: "planning a 40th birthday",
    },
    candidateWorkflows: ["special_occasion", "restaurants"],
    entities: emptyEntityModel(),
    constraints: emptyConstraintModel(),
    draftQueries: [],
    planFacets: dinnerFacets,
    confidence: 0.9,
    notes: null,
  };
  const adultPlan = resolvePlannerPlan(
    adultDraft,
    buildConversationContext({ city, history: [] }),
    "planning a 40th birthday dinner in Ballito",
  );
  assert.equal(adultPlan.constraints.budget, "upscale");
  assert.ok(
    adultPlan.diagnostics.rulesApplied.includes(
      "infer_upscale_elevated_celebration",
    ),
  );
  assert.notEqual(adultPlan.constraints.preferred.familyFriendly, true);

  const kidsPlan = resolvePlannerPlan(
    {
      intent: "kids birthday",
      goal: { primary: "kids_birthday", description: "kids birthday" },
      candidateWorkflows: ["special_occasion", "activities"],
      entities: emptyEntityModel(),
      constraints: emptyConstraintModel(),
      draftQueries: [],
      planFacets: kidsFacets,
      confidence: 0.85,
      notes: null,
    },
    buildConversationContext({ city, history: [] }),
    "its my kids birthday on monday",
  );
  assert.equal(kidsPlan.constraints.budget, null);
  assert.equal(kidsPlan.constraints.preferred.familyFriendly, true);
});

check("birthday dinner facets do not force family jewellery filter", () => {
  const adultDinnerFacets: PlanFacet[] = [
    {
      id: "dinner",
      label: "Birthday dinner",
      searchQuery: "special occasion restaurants",
      verticalHint: "restaurants",
    },
  ];
  const kept = filterCelebrationAudienceNoise(
    [
      biz({
        id: "j",
        name: "Ballito Jewellers",
        metadata: { verticals: ["jewellery"] },
      }),
      biz({
        id: "r",
        name: "Sea View Grill",
        category: "Restaurant",
      }),
    ],
    { facets: adultDinnerFacets },
  );
  assert.ok(kept.some((b) => b.id === "j"));
  assert.ok(kept.some((b) => b.id === "r"));
});

check("elevated ranking prefers upscale dining over casual", () => {
  const facets: PlanFacet[] = [
    {
      id: "dinner",
      label: "Birthday dinner",
      searchQuery: "special occasion dinner",
      verticalHint: "restaurants",
    },
  ];
  const plan: PlannerPlan = {
    version: "v2",
    intent: "40th",
    goal: { primary: "plan_special_occasion", description: "40th birthday" },
    workflow: "special_occasion",
    confidence: 0.9,
    entities: emptyEntityModel(),
    constraints: {
      ...emptyConstraintModel(),
      budget: "upscale",
    },
    missingInformation: [],
    needsClarification: false,
    clarificationQuestion: null,
    executionPlan: [],
    llmRequired: true,
    responseMode: "execute_and_explain",
    locationRef: null,
    diagnostics: {
      extractorConfidence: 0.9,
      rejectedWorkflows: [],
      rulesApplied: ["infer_upscale_elevated_celebration"],
      stickyEntitiesUsed: false,
    },
    composition: {
      ...defaultCompositionRequest("grouped_sections"),
      bucketProfile: "plan_facets",
      planFacets: facets,
    },
  };

  const casual = biz({
    id: "casual",
    name: "Rocomamas Ballito",
    category: "Burger restaurant",
    description: "burgers takeaway",
    priceLevel: 1,
    rating: 4.4,
    ratingCount: 1200,
    similarity: 0.82,
    metadata: {
      planFacetId: "dinner",
      attributes: { takeaway: true, familyFriendly: true },
    },
  });
  const nicer = biz({
    id: "nicer",
    name: "Coastal Table",
    category: "Fine dining restaurant",
    description: "sea view special occasion dinner",
    priceLevel: 3,
    rating: 4.6,
    ratingCount: 180,
    similarity: 0.78,
    metadata: {
      planFacetId: "dinner",
      attributes: {
        reservations: true,
        cocktails: true,
        romantic: true,
        seaView: true,
      },
    },
  });

  const ranked = rankBusinesses([casual, nicer], plan, {
    ...specialOccasionDefinition.rankConfig,
    preferVariety: false,
    minKeep: 2,
  });
  assert.equal(ranked[0]?.id, "nicer");
  assert.ok((ranked[0]?.score ?? 0) > (ranked[1]?.score ?? 0));
});

check("celebration keeps checklist facet labels not vibe buckets", () => {
  const facets: PlanFacet[] = [
    {
      id: "entertainment",
      label: "Entertainment",
      searchQuery: "party entertainment DJ hire",
      verticalHint: null,
    },
    {
      id: "cake",
      label: "Birthday cake",
      searchQuery: "birthday cake bakery",
      verticalHint: "bakeries",
    },
    {
      id: "dinner",
      label: "Birthday dinner",
      searchQuery: "special occasion dinner",
      verticalHint: "restaurants",
    },
  ];
  const ranked = [
    biz({
      id: "dj1",
      name: "Coast DJ",
      score: 80,
      metadata: { planFacetId: "entertainment" },
    }),
    biz({
      id: "cake1",
      name: "Sweet Slice",
      score: 75,
      metadata: { planFacetId: "cake", verticals: ["bakeries"] },
    }),
    biz({
      id: "fine1",
      name: "Harbour House",
      category: "Fine dining restaurant",
      priceLevel: 3,
      score: 90,
      metadata: { planFacetId: "dinner" },
    }),
    biz({
      id: "sea1",
      name: "Beachfront Grill",
      description: "sea view dining",
      score: 85,
      metadata: {
        planFacetId: "dinner",
        attributes: { seaView: true },
      },
    }),
  ];
  const request = {
    ...defaultCompositionRequest("grouped_sections"),
    bucketProfile: "plan_facets" as const,
    planFacets: facets,
    maxSections: 6,
    maxItemsPerSection: 6,
    minItemsPerSection: 1,
  };
  const sections = composePlanFacetSections(ranked, request);
  const titles = sections.map((s) => s.title);
  assert.deepEqual(titles, ["Entertainment", "Birthday cake", "Birthday dinner"]);
  assert.ok(!titles.some((t) => /Fine dining|Sea views|Date night/i.test(t)));
  assert.equal(executionPlanFromFacets(facets)[2]?.params.limit, 30);
  assert.equal(executionPlanFromFacets(facets)[0]?.params.limit, 18);
});

check("adult dining-only facets enrich to full party plan", () => {
  const diningOnly: PlanFacet[] = [
    {
      id: "dinner",
      label: "Special Occasion Dinner",
      searchQuery: "special occasion dinner",
      verticalHint: "restaurants",
    },
    {
      id: "cocktails",
      label: "Cocktail Bars",
      searchQuery: "cocktail bars",
      verticalHint: "nightlife",
    },
    {
      id: "sea",
      label: "Sea View Restaurants",
      searchQuery: "sea view restaurants",
      verticalHint: "restaurants",
    },
  ];
  const enriched = enrichCelebrationFacets(
    diningOnly,
    "planning a 40th birthday party in Ballito",
  );
  const labels = enriched.map((f) => f.label.toLowerCase());
  assert.ok(
    enriched.some(isDiningPlanFacet),
    "keeps a dinner facet",
  );
  assert.ok(
    labels.some((l) => /entertain/i.test(l)),
    `expected Entertainment, got ${enriched.map((f) => f.label).join(", ")}`,
  );
  assert.ok(
    labels.some((l) => /cake/i.test(l)),
    `expected cake, got ${enriched.map((f) => f.label).join(", ")}`,
  );
  assert.ok(
    enriched.filter(isDiningPlanFacet).length <= 2,
    "does not keep three restaurant-only facets",
  );
});

check("40th rewrites family/kids facets and forces upscale", () => {
  const familyish: PlanFacet[] = [
    {
      id: "birthday_dinner_family_friendly",
      label: "Family Friendly Birthday Dinner",
      searchQuery: "family friendly restaurants kids",
      verticalHint: "restaurants",
    },
    {
      id: "kids_entertainment",
      label: "Kids Entertainment",
      searchQuery: "kids soft play laser tag",
      verticalHint: "family",
    },
    {
      id: "birthday_cake",
      label: "Birthday Cake",
      searchQuery: "birthday cake bakery",
      verticalHint: "bakeries",
    },
  ];
  const enriched = enrichCelebrationFacets(
    familyish,
    "planning a 40th birthday in Ballito",
  );
  assert.ok(
    !enriched.some((f) => /family|kids/i.test(`${f.label} ${f.searchQuery}`)),
    `still had family/kids: ${enriched.map((f) => f.label).join(", ")}`,
  );
  assert.ok(enriched.some((f) => /dinner/i.test(f.label)));
  assert.ok(enriched.some((f) => /entertain/i.test(f.label)));

  const draft: PlannerDraft = {
    intent: "40th birthday",
    goal: {
      primary: "plan_special_occasion",
      description: "40th birthday",
    },
    candidateWorkflows: ["special_occasion"],
    entities: emptyEntityModel(),
    constraints: {
      ...emptyConstraintModel(),
      budget: "mid",
      preferred: {
        ...emptyConstraintModel().preferred,
        familyFriendly: true,
      },
    },
    draftQueries: [],
    planFacets: familyish,
    confidence: 0.9,
    notes: null,
  };
  const plan = resolvePlannerPlan(
    draft,
    buildConversationContext({ city, history: [] }),
    "planning a 40th birthday dinner party",
  );
  assert.equal(plan.constraints.budget, "upscale");
  assert.notEqual(plan.constraints.preferred.familyFriendly, true);
  assert.ok(
    !plan.composition.planFacets?.some((f) =>
      /family friendly|kids entertain/i.test(f.label),
    ),
  );
});

check("elevated ranking demotes Steers below occasion dining", () => {
  const facets: PlanFacet[] = [
    {
      id: "dinner",
      label: "Birthday dinner",
      searchQuery: "special occasion dinner",
      verticalHint: "restaurants",
    },
  ];
  const plan: PlannerPlan = {
    version: "v2",
    intent: "40th",
    goal: { primary: "plan_special_occasion", description: "40th birthday" },
    workflow: "special_occasion",
    confidence: 0.9,
    entities: emptyEntityModel(),
    constraints: {
      ...emptyConstraintModel(),
      budget: "upscale",
    },
    missingInformation: [],
    needsClarification: false,
    clarificationQuestion: null,
    executionPlan: [],
    llmRequired: true,
    responseMode: "execute_and_explain",
    locationRef: null,
    diagnostics: {
      extractorConfidence: 0.9,
      rejectedWorkflows: [],
      rulesApplied: [],
      stickyEntitiesUsed: false,
    },
    composition: {
      ...defaultCompositionRequest("grouped_sections"),
      bucketProfile: "plan_facets",
      planFacets: facets,
    },
  };
  const steers = biz({
    id: "steers",
    name: "Steers Ballito",
    category: "Burger restaurant",
    description: "burgers and chips",
    priceLevel: 1,
    rating: 4.2,
    ratingCount: 2000,
    similarity: 0.9,
    metadata: { planFacetId: "dinner" },
  });
  const nicer = biz({
    id: "nicer",
    name: "Bel Punto",
    category: "Italian restaurant",
    description: "special occasion dinner",
    priceLevel: 3,
    rating: 4.5,
    ratingCount: 200,
    similarity: 0.75,
    metadata: {
      planFacetId: "dinner",
      attributes: { reservations: true, romantic: true },
    },
  });
  const ranked = rankBusinesses([steers, nicer], plan, {
    ...specialOccasionDefinition.rankConfig,
    preferVariety: false,
    minKeep: 2,
  });
  assert.equal(ranked[0]?.id, "nicer");
  assert.ok((ranked.find((b) => b.id === "steers")?.score ?? 0) < 30);
});

check("restaurants mis-tagged to venue move into dinner section", () => {
  const facets: PlanFacet[] = [
    {
      id: "birthday_dinner",
      label: "Birthday Dinner",
      searchQuery: "special occasion dinner",
      verticalHint: "restaurants",
    },
    {
      id: "party_venue",
      label: "Party Venue",
      searchQuery: "party venue hire",
      verticalHint: "events",
    },
    {
      id: "birthday_cake",
      label: "Birthday Cake",
      searchQuery: "birthday cake bakery",
      verticalHint: "bakeries",
    },
  ];
  const ranked = [
    biz({
      id: "e454bf20-4286-4a14-91e5-1ff1b8684b51",
      name: "45 on Eat Street",
      category: "Fine Dining Restaurant",
      description: "Fine dining restaurant located in Lifestyle Centre, Ballito.",
      score: 42,
      metadata: {
        planFacetId: "party_venue",
        verticals: ["restaurants"],
      },
    }),
    biz({
      id: "venue1",
      name: "Ballito Events Hall",
      category: "Event venue",
      score: 40,
      metadata: { planFacetId: "party_venue", verticals: ["events"] },
    }),
    biz({
      id: "cake1",
      name: "Sweet Slice",
      category: "Bakery",
      score: 35,
      metadata: { planFacetId: "birthday_cake", verticals: ["bakeries"] },
    }),
  ];
  const sections = composePlanFacetSections(ranked, {
    ...defaultCompositionRequest("grouped_sections"),
    bucketProfile: "plan_facets",
    planFacets: facets,
    maxSections: 6,
    maxItemsPerSection: 8,
    minItemsPerSection: 1,
  });
  const dinner = sections.find((s) => s.title === "Birthday Dinner");
  const venue = sections.find((s) => s.title === "Party Venue");
  assert.ok(dinner?.businessIds.includes("e454bf20-4286-4a14-91e5-1ff1b8684b51"));
  assert.ok(!venue?.businessIds.includes("e454bf20-4286-4a14-91e5-1ff1b8684b51"));
  assert.ok(venue?.businessIds.includes("venue1"));
});

check("nightlife hint aliases to bars", () => {
  const cleaned = sanitizePlanFacets([
    {
      id: "drinks",
      label: "Cocktails",
      searchQuery: "cocktail bar Ballito",
      verticalHint: "nightlife",
    },
  ]);
  assert.equal(cleaned[0]?.verticalHint, "bars");
  assert.equal(isDiningPlanFacet(cleaned[0]!), true);
});

check("scenic facets default to attractions", () => {
  const cleaned = sanitizePlanFacets([
    {
      id: "scenic",
      label: "Scenic Spots",
      searchQuery: "scenic backdrop peaceful vibes Ballito",
      verticalHint: null,
    },
  ]);
  assert.equal(cleaned[0]?.verticalHint, "attractions");
});

check("sea-view dinner stays restaurants not attractions", () => {
  const cleaned = sanitizePlanFacets([
    {
      id: "dinner",
      label: "Romantic Dinner",
      searchQuery: "romantic restaurant sea view Ballito",
      verticalHint: null,
    },
  ]);
  assert.equal(cleaned[0]?.verticalHint, "restaurants");
});

check("facet fit drops junk from photo florist dinner scenic", () => {
  const facets: PlanFacet[] = [
    {
      id: "dinner",
      label: "Romantic Dinner",
      searchQuery: "romantic restaurant",
      verticalHint: "restaurants",
    },
    {
      id: "photo",
      label: "Proposal Photography",
      searchQuery: "proposal photographer",
      verticalHint: "photography",
    },
    {
      id: "flowers",
      label: "Floral Arrangements",
      searchQuery: "florist bouquet",
      verticalHint: "florists",
    },
    {
      id: "scenic",
      label: "Scenic Spots",
      searchQuery: "scenic backdrop",
      verticalHint: "attractions",
    },
  ];
  const pool = [
    biz({
      id: "abbiocco",
      name: "Abbiocco Italian Restaurant and Deli",
      category: "Italian Restaurant",
      metadata: { planFacetId: "dinner", verticals: ["restaurants"] },
    }),
    biz({
      id: "spa-dinner",
      name: "Blissful Massage",
      category: "Massage",
      metadata: { planFacetId: "dinner", verticals: ["spas"] },
    }),
    biz({
      id: "photo-ok",
      name: "Precision Photography Ballito",
      category: "Photographer",
      metadata: { planFacetId: "photo", verticals: ["photography"] },
    }),
    biz({
      id: "attorney",
      name: "Attorneys Ballito - G Grobbelaar Inc",
      category: "Attorney",
      metadata: { planFacetId: "photo", verticals: ["legal"] },
    }),
    biz({
      id: "handyman",
      name: "The Ballito Handyman",
      category: "General Contractor",
      metadata: { planFacetId: "photo", verticals: ["handyman"] },
    }),
    biz({
      id: "florist-ok",
      name: "Fancy Flowers and Gifts",
      category: "Florist",
      metadata: { planFacetId: "flowers", verticals: ["florists"] },
    }),
    biz({
      id: "funeral",
      name: "Ballito Funeral Directors",
      category: "Funeral Home",
      metadata: { planFacetId: "flowers", verticals: ["funeral"] },
    }),
    biz({
      id: "curtains",
      name: "DECO BALLITO Curtains Blinds Shutters",
      category: "Curtain store",
      metadata: { planFacetId: "flowers", verticals: ["blinds-flooring"] },
    }),
    biz({
      id: "beach",
      name: "Ballito Beach Viewpoint",
      category: "Tourist attraction",
      metadata: { planFacetId: "scenic", verticals: ["attractions"] },
    }),
    biz({
      id: "zenju",
      name: "ZENJU DAY SPA BALLITO",
      category: "Spa",
      metadata: { planFacetId: "scenic", verticals: ["spas"] },
    }),
    biz({
      id: "accommodation",
      name: "Ballito Accommodation",
      category: "Travel Agency",
      metadata: { planFacetId: "scenic", verticals: ["travel"] },
    }),
  ];
  const kept = filterPlanFacetVerticalFit(pool, facets).map((b) => b.id);
  assert.deepEqual(
    kept.sort(),
    ["abbiocco", "beach", "florist-ok", "photo-ok"].sort(),
  );
});

check("elevated casual drops Mozambik Tiger Milk Skippies", () => {
  const facets: PlanFacet[] = [
    {
      id: "dinner",
      label: "Romantic Dinner",
      searchQuery: "romantic dinner",
      verticalHint: "restaurants",
    },
  ];
  const kept = filterElevatedCasualDining(
    [
      biz({
        id: "moz",
        name: "Mozambik Ballito",
        category: "Restaurant",
        metadata: { planFacetId: "dinner" },
      }),
      biz({
        id: "tiger",
        name: "Tiger's Milk Ballito",
        category: "Restaurant",
        metadata: { planFacetId: "dinner" },
      }),
      biz({
        id: "skip",
        name: "Skippies Restaurant & Bar Ballito",
        category: "Family Restaurant",
        metadata: { planFacetId: "dinner" },
      }),
      biz({
        id: "fine",
        name: "45 on Eat Street",
        category: "Fine Dining Restaurant",
        metadata: { planFacetId: "dinner" },
      }),
    ],
    { elevated: true, facets },
  );
  assert.deepEqual(
    kept.map((b) => b.id),
    ["fine"],
  );
});

check("restaurants vertical filter drops spa from dining deepen pool", () => {
  const filtered = filterByVerticalHint(
    [
      biz({
        id: "spa",
        name: "Blissful Massage",
        category: "Massage",
        metadata: { verticals: ["spas"] },
      }),
      biz({
        id: "rest",
        name: "Abbiocco",
        category: "Italian Restaurant",
        metadata: { verticals: ["restaurants"] },
      }),
      biz({
        id: "attorney",
        name: "Attorneys Ballito",
        category: "Attorney",
        metadata: { verticals: ["legal"] },
      }),
    ],
    "restaurants",
  );
  assert.deepEqual(
    filtered.map((b) => b.id),
    ["rest"],
  );
});

check("Pass 2 does not soft-assign junk into photography", () => {
  const facets: PlanFacet[] = [
    {
      id: "photo",
      label: "Proposal Photography",
      searchQuery: "proposal photographer Ballito",
      verticalHint: "photography",
    },
    {
      id: "dinner",
      label: "Romantic Dinner",
      searchQuery: "romantic dinner",
      verticalHint: "restaurants",
    },
  ];
  const ranked = [
    biz({
      id: "photo-ok",
      name: "Bowditch Photography",
      category: "Photographer",
      metadata: { planFacetId: "photo", verticals: ["photography"] },
    }),
    biz({
      id: "recruit",
      name: "Talented Recruitment Specialists",
      category: "Employment agency",
      description: "specialists services Ballito",
      // no planFacetId — would soft-match "special" tokens historically
    }),
  ];
  const sections = composePlanFacetSections(ranked, {
    ...defaultCompositionRequest("grouped_sections"),
    bucketProfile: "plan_facets",
    planFacets: facets,
    maxSections: 6,
    maxItemsPerSection: 4,
    minItemsPerSection: 1,
  });
  const photo = sections.find((s) => s.title === "Proposal Photography");
  assert.ok(photo?.businessIds.includes("photo-ok"));
  assert.ok(!photo?.businessIds.includes("recruit"));
});

check("adult downtime: detect kids-free / spouse day-off ask", () => {
  assert.equal(
    isAdultDowntimeAsk("my husband needs a special day off from the kids"),
    true,
  );
  assert.equal(isCelebrationAsk("my husband needs a special day off from the kids"), false);
  assert.equal(
    celebrationTitleHint("my husband needs a special day off from the kids"),
    "A day off for him",
  );
  assert.equal(isAdultDowntimeAsk("plan a birthday party for my son"), false);
  assert.equal(isAdultDowntimeAsk("anniversary dinner without the kids"), false);
});

check("adult downtime: rewrite facets away from celebration / mall junk", () => {
  const bad: PlanFacet[] = [
    {
      id: "relaxing",
      label: "Relaxing Activities",
      searchQuery: "spa massage Ballito",
      verticalHint: null,
    },
    {
      id: "quiet",
      label: "Quiet Restaurants",
      searchQuery: "quiet restaurants Ballito",
      verticalHint: "restaurants",
    },
    {
      id: "gents",
      label: "Gentlemen's Activities",
      searchQuery: "gentlemen activities Ballito",
      verticalHint: null,
    },
  ];
  const out = enrichCelebrationFacets(
    bad,
    "my husband needs a special day off from the kids",
  );
  assert.ok(out.length >= 2 && out.length <= 3);
  assert.ok(out.some((f) => f.verticalHint === "spas"));
  assert.ok(out.some(isDiningPlanFacet));
  assert.ok(
    out.some((f) => f.verticalHint === "attractions" || /golf|outdoor/i.test(f.label)),
  );
  assert.ok(!out.some((f) => /gentlemen/i.test(f.label)));
});

check("adult downtime: drop Steers and mall/cleaning from facets", () => {
  const facets = enrichCelebrationFacets(
    [],
    "day off from the kids for my husband",
  );
  const pool = [
    biz({
      id: "spa1",
      name: "ZENJU DAY SPA BALLITO",
      category: "Spa",
      metadata: { planFacetId: "spa_unwind", verticals: ["spas"] },
    }),
    biz({
      id: "steers",
      name: "Steers Ballito Junction",
      category: "Hamburger Restaurant",
      metadata: { planFacetId: "quiet_dining", verticals: ["restaurants"] },
    }),
    biz({
      id: "abbiocco",
      name: "Abbiocco Italian Restaurant and Deli",
      category: "Italian Restaurant",
      metadata: { planFacetId: "quiet_dining", verticals: ["restaurants"] },
    }),
    biz({
      id: "mall",
      name: "Ballito Lifestyle Centre",
      category: "Shopping Mall",
      metadata: { planFacetId: "outdoors", verticals: ["shopping"] },
    }),
    biz({
      id: "clean",
      name: "WE CLEAN BALLITO",
      category: "Services",
      metadata: { planFacetId: "outdoors", verticals: ["cleaning"] },
    }),
    biz({
      id: "horse",
      name: "Ballito Horse Trails",
      category: "Sports Activity Location",
      metadata: { planFacetId: "outdoors", verticals: ["attractions"] },
    }),
  ];
  let filtered = filterElevatedCasualDining(pool, {
    elevated: true,
    facets,
  });
  filtered = filterPlanFacetVerticalFit(filtered, facets);
  filtered = filterCelebrationAudienceNoise(filtered, {
    adultDowntime: true,
    familyFriendly: false,
    facets,
  });
  const names = filtered.map((b) => b.name);
  assert.ok(names.includes("ZENJU DAY SPA BALLITO"));
  assert.ok(names.includes("Abbiocco Italian Restaurant and Deli"));
  assert.ok(names.includes("Ballito Horse Trails"));
  assert.ok(!names.includes("Steers Ballito Junction"));
  assert.ok(!names.includes("Ballito Lifestyle Centre"));
  assert.ok(!names.includes("WE CLEAN BALLITO"));
});

check("adult downtime: resolver clears familyFriendly and celebration title", () => {
  const draft: PlannerDraft = {
    intent: "adult_downtime",
    goal: {
      primary: "plan_special_occasion",
      description: "day off for husband without kids",
    },
    confidence: 0.9,
    candidateWorkflows: ["special_occasion"],
    entities: {
      ...emptyEntityModel(),
      people: ["husband", "kids"],
    },
    constraints: emptyConstraintModel(),
    draftQueries: ["spa Ballito"],
    planFacets: [
      {
        id: "relaxing",
        label: "Relaxing Activities",
        searchQuery: "spa",
        verticalHint: null,
      },
      {
        id: "quiet",
        label: "Quiet Restaurants",
        searchQuery: "restaurants",
        verticalHint: "restaurants",
      },
      {
        id: "gents",
        label: "Gentlemen's Activities",
        searchQuery: "activities",
        verticalHint: null,
      },
    ],
    notes: "",
  };
  const ctx = buildConversationContext({
    city,
    history: [],
    stickySummary: null,
  });
  const plan = resolvePlannerPlan(
    draft,
    ctx,
    "my husband needs a special day off from the kids",
  );
  assert.equal(plan.workflow, "special_occasion");
  assert.equal(plan.constraints.preferred.familyFriendly, false);
  assert.equal(plan.constraints.preferred.quiet, true);
  assert.equal(plan.composition.titleHint, "A day off for him");
  assert.ok(
    plan.diagnostics.rulesApplied.some((r) =>
      /adult_downtime/.test(r),
    ),
  );
  assert.ok(!/celebration/i.test(plan.composition.titleHint ?? ""));
});

console.log(`\n${passed} checks passed.`);
