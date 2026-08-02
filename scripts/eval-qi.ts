/**
 * Offline + optional live Query Intelligence understanding eval.
 *
 * Offline gates: schema, corpus size, short-circuit policy, fixture shape.
 * Live: EVAL_LIVE=1 runs QI (or extractor fallback) and scores gold cases.
 *
 * Usage:
 *   npm run eval:qi
 *   EVAL_LIVE=1 QUERY_INTELLIGENCE=1 npm run eval:qi
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { classifyQuery } from "../src/services/classifier/classify";
import {
  isDeterministicClassifierOnly,
  shouldShortCircuitExtractor,
} from "../src/config/short-circuit-policy";
import {
  queryIntelligenceResultSchema,
} from "../src/lib/ai/prompts/query-intelligence.v1";
import { FAILURE_LAYERS } from "../src/services/eval/failure-taxonomy";

type QiCase = {
  id: string;
  query: string;
  city: string;
  expectGoalPrimaryIncludes?: string[];
  expectDomains?: string[];
  expectAudience?: string;
  expectMinSearchConcepts?: number;
  expectMinFacets?: number;
  expectConceptHints?: string[];
  forbidConceptHints?: string[];
  expectHardExclusionHints?: string[];
  expectConstraintFlags?: string[];
  expectNeedsClarification?: boolean;
  allowEitherClarifyOrLowConfidence?: boolean;
};

type QiDataset = { version: number; cases: QiCase[] };

let passed = 0;
let failed = 0;

function check(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ok  ${name}`);
    passed += 1;
  } catch (err) {
    failed += 1;
    console.error(`FAIL  ${name}`);
    console.error(err instanceof Error ? err.message : err);
  }
}

console.log("Query Intelligence eval\n");

const goldPath = join(process.cwd(), "evals", "query-intelligence.json");
const gold = JSON.parse(readFileSync(goldPath, "utf8")) as QiDataset;
const corpusPath = join(
  process.cwd(),
  "evals",
  "audit",
  "query-intelligence-corpus.json",
);
const corpus = JSON.parse(readFileSync(corpusPath, "utf8")) as {
  questions: unknown[];
};

check("QI gold loads (≥8 cases)", () => {
  assert.ok(Array.isArray(gold.cases) && gold.cases.length >= 8);
});

check("audit corpus ≥80 questions", () => {
  assert.ok(corpus.questions.length >= 80, `got ${corpus.questions.length}`);
});

check("failure taxonomy has 11 layers", () => {
  assert.equal(FAILURE_LAYERS.length, 11);
});

check("queryIntelligenceResultSchema accepts kids-play shape", () => {
  const sample = {
    goal: { primary: "kids_play", description: "Places kids can play" },
    domains: ["activity", "business"],
    entities: {
      locations: [],
      estates: [],
      landmarks: [],
      businessTypes: ["play centre"],
      cuisines: [],
      dates: [],
      times: [],
      people: ["kids"],
    },
    explicitConstraints: {
      outdoorSeating: null,
      seaView: null,
      familyFriendly: true,
      romantic: null,
      petFriendly: null,
      parking: null,
      wheelchairAccessible: null,
      kidsArea: true,
      breakfast: null,
      lunch: null,
      dinner: null,
      quiet: null,
      rainFriendly: null,
      outdoorPlay: null,
      indoorPlay: null,
      wifi: null,
    },
    implicitPreferences: {
      outdoorSeating: null,
      seaView: null,
      familyFriendly: true,
      romantic: null,
      petFriendly: null,
      parking: null,
      wheelchairAccessible: null,
      kidsArea: true,
      breakfast: null,
      lunch: null,
      dinner: null,
      quiet: null,
      rainFriendly: null,
      outdoorPlay: null,
      indoorPlay: null,
      wifi: null,
    },
    explicitEnvironment: null,
    implicitEnvironment: null,
    hardExclusions: [],
    softPreferences: ["family friendly"],
    audience: "family_kids",
    locationIntent: { kind: "city", labels: ["Ballito"] },
    temporalIntent: { openNow: null, meal: null, when: null },
    desiredResultType: "grouped_facets",
    facets: [
      {
        id: "indoor_play",
        label: "Indoor play",
        need: "indoor kids play",
        searchConcepts: ["indoor play centre", "soft play"],
        entityKinds: ["business"],
        verticalHint: "family",
        hard: true,
      },
    ],
    searchConcepts: [
      "indoor play centre",
      "soft play",
      "trampoline",
      "adventure park",
      "farm activity",
      "outdoor playground",
    ],
    diversityRequirements: {
      minDistinctConcepts: 3,
      avoidNearDuplicates: true,
    },
    grouping: { strategy: "by_facet", sectionLabels: ["Indoor play"] },
    needsClarification: false,
    clarificationQuestion: null,
    confidence: 0.9,
    candidateWorkflows: ["activities"],
  };
  const parsed = queryIntelligenceResultSchema.parse(sample);
  assert.ok(parsed.searchConcepts.length >= 3);
});

check("short-circuit policy: sushi is NOT deterministic-only", () => {
  const c = classifyQuery({
    message: "Best sushi in Ballito",
    citySlug: "ballito",
  });
  assert.equal(isDeterministicClassifierOnly(c), false);
});

check("short-circuit policy: FAQ is deterministic-only", () => {
  const c = classifyQuery({
    message: "what is ask ballito",
    citySlug: "ballito",
  });
  assert.ok(isDeterministicClassifierOnly(c));
});

check("short-circuit policy: emergency is deterministic-only", () => {
  const c = classifyQuery({
    message: "someone is having a heart attack call ambulance",
    citySlug: "ballito",
  });
  assert.ok(
    isDeterministicClassifierOnly(c) || c.signals.includes("true_safety_emergency"),
  );
});

check("with QUERY_INTELLIGENCE=1, sushi does not short-circuit", () => {
  const prev = process.env.QUERY_INTELLIGENCE;
  process.env.QUERY_INTELLIGENCE = "1";
  const c = classifyQuery({
    message: "Best sushi in Ballito",
    citySlug: "ballito",
  });
  assert.equal(shouldShortCircuitExtractor(c), false);
  if (prev === undefined) delete process.env.QUERY_INTELLIGENCE;
  else process.env.QUERY_INTELLIGENCE = prev;
});

check("legacy (QI off): high-conf business can still short-circuit", () => {
  const prevQi = process.env.QUERY_INTELLIGENCE;
  const prevSc = process.env.CLASSIFIER_SHORT_CIRCUIT;
  process.env.QUERY_INTELLIGENCE = "0";
  process.env.CLASSIFIER_SHORT_CIRCUIT = "1";
  const c = classifyQuery({
    message: "Best sushi in Ballito",
    citySlug: "ballito",
  });
  assert.equal(shouldShortCircuitExtractor(c), true);
  if (prevQi === undefined) delete process.env.QUERY_INTELLIGENCE;
  else process.env.QUERY_INTELLIGENCE = prevQi;
  if (prevSc === undefined) delete process.env.CLASSIFIER_SHORT_CIRCUIT;
  else process.env.CLASSIFIER_SHORT_CIRCUIT = prevSc;
});

for (const c of gold.cases) {
  check(`fixture shape ${c.id}`, () => {
    assert.ok(c.query && c.city);
  });
}

async function runLive() {
  if (process.env.EVAL_LIVE !== "1") return;
  console.log("\nLive QI understanding scores\n");
  const { queryIntelligenceService } = await import(
    "../src/services/planner/query-intelligence.service"
  );
  const { CITIES } = await import("../src/config/cities");
  const { buildConversationContext } = await import(
    "../src/services/planner/context"
  );

  let goalHits = 0;
  let domainHits = 0;
  let conceptHits = 0;
  let clarifyHits = 0;
  let n = 0;

  for (const c of gold.cases) {
    n += 1;
    const city = CITIES.find((x) => x.slug === c.city) ?? CITIES[0]!;
    const context = buildConversationContext({
      city,
      history: [],
      stickySummary: null,
    });
    const { result } = await queryIntelligenceService.understand({
      context,
      message: c.query,
    });

    const goal = `${result.goal.primary} ${result.goal.description}`.toLowerCase();
    if (
      !c.expectGoalPrimaryIncludes ||
      c.expectGoalPrimaryIncludes.some((h) => goal.includes(h.toLowerCase()))
    ) {
      goalHits += 1;
    }

    if (
      !c.expectDomains ||
      c.expectDomains.some((d) => result.domains.includes(d as never))
    ) {
      domainHits += 1;
    }

    const concepts = [
      ...result.searchConcepts,
      ...result.facets.flatMap((f) => f.searchConcepts),
    ]
      .join(" ")
      .toLowerCase();
    const minConcepts =
      c.expectMinSearchConcepts ?? c.expectConceptHints?.length ? 1 : 0;
    const conceptOk =
      result.searchConcepts.length +
        result.facets.reduce((a, f) => a + f.searchConcepts.length, 0) >=
        (c.expectMinSearchConcepts ?? 0) &&
      (!c.expectConceptHints ||
        c.expectConceptHints.some((h) => concepts.includes(h.toLowerCase()))) &&
      (!c.forbidConceptHints ||
        !c.forbidConceptHints.some((h) => concepts.includes(h.toLowerCase())));
    if (conceptOk || minConcepts === 0) conceptHits += 1;

    const clarifyOk =
      c.expectNeedsClarification == null ||
      result.needsClarification === c.expectNeedsClarification ||
      (c.allowEitherClarifyOrLowConfidence &&
        (result.needsClarification || result.confidence < 0.55));
    if (clarifyOk) clarifyHits += 1;

    console.log(
      `  ${c.id}: goal=${goalHits >= n ? "ok" : "miss"} concepts=${conceptOk ? "ok" : "miss"} clarify=${clarifyOk ? "ok" : "miss"} conf=${result.confidence.toFixed(2)}`,
    );
  }

  check(`live goal accuracy ≥70% (${goalHits}/${n})`, () => {
    assert.ok(goalHits / n >= 0.7);
  });
  check(`live domain accuracy ≥70% (${domainHits}/${n})`, () => {
    assert.ok(domainHits / n >= 0.7);
  });
  check(`live concept quality ≥60% (${conceptHits}/${n})`, () => {
    assert.ok(conceptHits / n >= 0.6);
  });
  check(`live clarify accuracy ≥70% (${clarifyHits}/${n})`, () => {
    assert.ok(clarifyHits / n >= 0.7);
  });
}

runLive()
  .then(() => {
    console.log(`\n${passed} passed, ${failed} failed`);
    if (failed > 0) process.exit(1);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
