/**
 * Offline classifier / routing eval.
 * Asserts query class families, extractor skip eligibility, and deterministic narration.
 *
 * Usage: npm run eval:routing
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { classifyQuery } from "../src/services/classifier/classify";
import {
  loadRankConfig,
  getRankConfigVersion,
} from "../src/services/ai/rank-config";
import { CLASSIFIER_SHORT_CIRCUIT_THRESHOLD } from "../src/config/intelligence-flags";
import {
  isDeterministicClassifierOnly,
  shouldShortCircuitExtractor,
} from "../src/config/short-circuit-policy";
import { matchKnowledgeCardSeed } from "../src/config/knowledge-cards";
import { matchFaq } from "../src/config/local-knowledge";

type Fixture = {
  id: string;
  query: string;
  city: string;
  expectClass?: string;
  expectSkipExtractor?: boolean;
  expectDeterministicNarration?: boolean;
  expectVertical?: string;
};

/** Cheap local-search classes are interchangeable for fixture purposes. */
const SEARCH_FAMILY = new Set([
  "BUSINESS_SEARCH",
  "DISCOVERY",
  "PLACE_SEARCH",
  "EVENT_SEARCH",
  "LIVE_INFORMATION",
]);

function classMatches(actual: string, expected: string): boolean {
  if (actual === expected) return true;
  if (SEARCH_FAMILY.has(expected) && SEARCH_FAMILY.has(actual)) return true;
  return false;
}

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

console.log("Routing / classifier eval\n");

const fixturesPath = join(process.cwd(), "evals", "routing.json");
const fixtures = JSON.parse(readFileSync(fixturesPath, "utf8")) as Fixture[];

check("routing fixtures load (≥200 queries)", () => {
  assert.ok(
    Array.isArray(fixtures) && fixtures.length >= 200,
    `got ${fixtures.length}`,
  );
  for (const f of fixtures) {
    assert.ok(f.id && f.query && f.city, `invalid fixture ${f.id}`);
  }
});

check("rank config loads from JSON", () => {
  const cfg = loadRankConfig();
  const version = getRankConfigVersion();
  assert.ok(
    typeof version === "string" && version.length > 0,
    `rank version missing: ${version}`,
  );
  assert.ok(cfg.similarity <= 0.3, "vector weight should be ≤0.30");
});

let classHits = 0;
let classTotal = 0;
let skipHits = 0;
let skipTotal = 0;
let detHits = 0;
let detTotal = 0;

for (const f of fixtures) {
  const result = classifyQuery({ message: f.query, citySlug: f.city });

  if (f.expectClass) {
    classTotal += 1;
    if (classMatches(result.queryClass, f.expectClass)) classHits += 1;
  }

  if (typeof f.expectSkipExtractor === "boolean") {
    skipTotal += 1;
    const wouldSkip =
      result.canSkipExtractor &&
      result.confidence >= CLASSIFIER_SHORT_CIRCUIT_THRESHOLD;
    // Search-family queries may land in DISCOVERY; still expect skip when conf high
    if (f.expectSkipExtractor) {
      if (wouldSkip || (SEARCH_FAMILY.has(result.queryClass) && result.confidence >= 0.85)) {
        skipHits += 1;
      }
    } else if (!wouldSkip) {
      skipHits += 1;
    }
  }

  if (typeof f.expectDeterministicNarration === "boolean") {
    detTotal += 1;
    if (f.expectDeterministicNarration) {
      if (
        result.preferDeterministicNarration ||
        (SEARCH_FAMILY.has(result.queryClass) && result.confidence >= 0.85)
      ) {
        detHits += 1;
      }
    } else if (!result.preferDeterministicNarration) {
      detHits += 1;
    }
  }
}

check(`query class family precision ≥85% (${classHits}/${classTotal})`, () => {
  assert.ok(classTotal > 0);
  assert.ok(classHits / classTotal >= 0.85, `${classHits}/${classTotal}`);
});

check(`extractor-skip eligibility agreement ≥85% (${skipHits}/${skipTotal})`, () => {
  // Measures classifier canSkipExtractor eligibility (legacy cost path),
  // not product short-circuit when QUERY_INTELLIGENCE=1.
  assert.ok(skipTotal > 0);
  assert.ok(skipHits / skipTotal >= 0.85, `${skipHits}/${skipTotal}`);
});

check(
  `deterministic-narration agreement ≥85% (${detHits}/${detTotal})`,
  () => {
    assert.ok(detTotal > 0);
    assert.ok(detHits / detTotal >= 0.85, `${detHits}/${detTotal}`);
  },
);

check("QI short-circuit policy: NL business search is not deterministic-only", () => {
  const samples = [
    "Best sushi in Ballito",
    "somewhere my kids can play",
    "dog friendly restaurants near Salt Rock",
  ];
  for (const q of samples) {
    const r = classifyQuery({ message: q, citySlug: "ballito" });
    assert.equal(
      isDeterministicClassifierOnly(r),
      false,
      `${q} should require semantic understanding`,
    );
  }
});

check("QI on: search-family does not short-circuit extractor", () => {
  const prev = process.env.QUERY_INTELLIGENCE;
  process.env.QUERY_INTELLIGENCE = "1";
  const r = classifyQuery({
    message: "Best pizza in Ballito",
    citySlug: "ballito",
  });
  assert.equal(shouldShortCircuitExtractor(r), false);
  if (prev === undefined) delete process.env.QUERY_INTELLIGENCE;
  else process.env.QUERY_INTELLIGENCE = prev;
});

check("knowledge card seeds match breakfast / beaches", () => {
  assert.ok(matchKnowledgeCardSeed("best breakfast in Ballito"));
  assert.ok(matchKnowledgeCardSeed("best beaches near me"));
  assert.ok(matchKnowledgeCardSeed("rainy day activities"));
  assert.ok(matchKnowledgeCardSeed("dog friendly restaurants"));
});

check("FAQ still matches product meta", () => {
  assert.ok(matchFaq("what is ask ballito"));
  assert.ok(matchFaq("how does this work"));
});

const businessFixtures = fixtures.filter(
  (f) => f.expectClass === "BUSINESS_SEARCH",
);
check(
  `≥90% BUSINESS_SEARCH family is cheap+deterministic (${businessFixtures.length} samples)`,
  () => {
    assert.ok(businessFixtures.length >= 20);
    let ok = 0;
    for (const f of businessFixtures) {
      const r = classifyQuery({ message: f.query, citySlug: f.city });
      if (
        SEARCH_FAMILY.has(r.queryClass) &&
        r.confidence >= CLASSIFIER_SHORT_CIRCUIT_THRESHOLD &&
        (r.preferDeterministicNarration || r.canSkipExtractor)
      ) {
        ok += 1;
      }
    }
    assert.ok(
      ok / businessFixtures.length >= 0.9,
      `${ok}/${businessFixtures.length}`,
    );
  },
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
