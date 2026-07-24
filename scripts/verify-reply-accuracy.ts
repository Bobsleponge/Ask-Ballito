/**
 * Reply-accuracy verification process (offline).
 *
 * Ensures exact-niche asks:
 *  - are classified as exact (not leisure browse)
 *  - use ranked_list (not "Ideas by vibe")
 *  - ask-fit keeps only on-intent businesses
 *  - never retain forbidden categories when a pool is provided
 *
 * Add cases to evals/reply-accuracy.json when a bad live reply is found.
 *
 * Run: npm run verify:replies
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  filterByAskFit,
  isExactNicheAsk,
  isLeisureBrowseAsk,
} from "../src/services/planner/exact-niche-guard";
import {
  filterProductSpecialists,
} from "../src/services/planner/shopping-relevance";
import {
  filterMusicSpecialists,
} from "../src/services/planner/music-intent";
import { isProductPurchaseAsk } from "../src/services/planner/product-intent";
import { isMusicInstrumentAsk } from "../src/services/planner/music-intent";
import {
  filterCelebrationAudienceNoise,
  isCelebrationAsk,
  isKidsCelebrationAsk,
} from "../src/services/planner/special-occasion-intent";
import { filterToTradeKind, detectTradeKind } from "../src/services/planner/trade-query";
import { buildCompositionRequest } from "../src/services/composition/request";
import { resolvePlannerPlan } from "../src/services/planner/resolver";
import { buildConversationContext } from "../src/services/planner/context";
import {
  emptyConstraintModel,
  emptyEntityModel,
  type PlanFacet,
  type PlannerDraft,
} from "../src/services/planner/types";
import type { BusinessResult } from "../src/lib/schemas/business";
import { CITIES } from "../src/config/cities";

interface PoolBiz {
  id: string;
  name: string;
  category?: string;
  description?: string;
  verticals?: string[];
}

interface Case {
  id: string;
  query: string;
  expectExact: boolean;
  expectStrategy?: string;
  expectBucketProfile?: string;
  expectTitleHintIncludes?: string;
  expectWorkflow?: string;
  planFacets?: PlanFacet[];
  forbidCategorySubstrings?: string[];
  allowEmpty?: boolean;
  pool?: PoolBiz[];
  expectKeepIds?: string[];
  expectDropIds?: string[];
  familyFilter?: boolean;
  romanticFilter?: boolean;
}

function toBiz(p: PoolBiz): BusinessResult {
  return {
    id: p.id,
    name: p.name,
    category: p.category ?? null,
    description: p.description ?? null,
    address: null,
    phone: null,
    website: null,
    rating: 4.5,
    ratingCount: 10,
    priceLevel: null,
    lat: null,
    lng: null,
    photos: [],
    metadata: p.verticals ? { verticals: p.verticals } : {},
  };
}

/** Apply the same specialist → ask-fit stack conversation uses for exact asks. */
function filterForQuery(
  query: string,
  pool: BusinessResult[],
  c: Case,
): BusinessResult[] {
  let list = pool;
  if (c.familyFilter || c.romanticFilter || c.planFacets?.length) {
    return filterCelebrationAudienceNoise(list, {
      familyFriendly: c.familyFilter === true,
      romantic: c.romanticFilter === true,
      kidsAsk: isKidsCelebrationAsk(query),
      facets: c.planFacets ?? [],
    });
  }
  if (isProductPurchaseAsk(query)) {
    list = filterProductSpecialists(list);
    return list;
  }
  if (isMusicInstrumentAsk(query)) {
    list = filterMusicSpecialists(list);
    return list;
  }
  const trade = detectTradeKind(query);
  if (trade) {
    list = filterToTradeKind(list, trade, { strict: true });
  }
  if (isExactNicheAsk(query)) {
    list = filterByAskFit(list, query);
  }
  return list;
}

const path = join(process.cwd(), "evals", "reply-accuracy.json");
const doc = JSON.parse(readFileSync(path, "utf8")) as {
  cases: Case[];
};

const city = CITIES.find((c) => c.slug === "ballito") ?? CITIES[0]!;
let passed = 0;
const failures: string[] = [];

function check(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ok  ${name}`);
    passed += 1;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  FAIL  ${name}: ${msg}`);
    failures.push(`${name}: ${msg}`);
  }
}

console.log("Reply accuracy verification\n");

for (const c of doc.cases) {
  check(`${c.id}: exact classification`, () => {
    const exact = isExactNicheAsk(c.query);
    assert.equal(
      exact,
      c.expectExact,
      `isExactNicheAsk=${exact}, leisure=${isLeisureBrowseAsk(c.query)}`,
    );
  });

  if (c.expectStrategy) {
    check(`${c.id}: composition strategy`, () => {
      const facets = c.planFacets ?? [];
      const celebration = facets.length >= 2 || isCelebrationAsk(c.query);
      const { request } = buildCompositionRequest({
        goalPrimary: celebration
          ? isKidsCelebrationAsk(c.query)
            ? "kids_birthday"
            : "plan_special_occasion"
          : c.expectExact
            ? "services"
            : "activities",
        goalDescription: c.query,
        intent: c.query,
        workflowId: celebration
          ? "special_occasion"
          : c.expectExact
            ? "services"
            : "activities",
        defaultStrategy: c.expectExact ? "ranked_list" : "grouped_sections",
        entities: emptyEntityModel(),
        constraints: emptyConstraintModel(),
        locationRef: null,
        planFacets: facets,
      });
      assert.equal(request.strategy, c.expectStrategy);
      if (c.expectBucketProfile) {
        assert.equal(request.bucketProfile, c.expectBucketProfile);
      }
      if (c.expectTitleHintIncludes) {
        assert.ok(
          (request.titleHint ?? "")
            .toLowerCase()
            .includes(c.expectTitleHintIncludes.toLowerCase()),
          `titleHint=${request.titleHint}`,
        );
      }

      const draft: PlannerDraft = {
        intent: c.query,
        goal: {
          primary: celebration
            ? isKidsCelebrationAsk(c.query)
              ? "kids_birthday"
              : "plan_special_occasion"
            : c.expectExact
              ? "services"
              : "activities",
          description: c.query,
        },
        candidateWorkflows: celebration
          ? ["special_occasion", "activities", "general"]
          : c.expectExact
            ? ["services", "activities", "general"]
            : ["activities", "general"],
        entities: emptyEntityModel(),
        constraints: emptyConstraintModel(),
        draftQueries: [],
        planFacets: facets,
        confidence: 0.75,
        notes: null,
      };
      const plan = resolvePlannerPlan(
        draft,
        buildConversationContext({ city, history: [] }),
        c.query,
      );
      assert.equal(plan.composition.strategy, c.expectStrategy);
      if (c.expectWorkflow) {
        assert.equal(plan.workflow, c.expectWorkflow);
      }
      if (celebration && facets.length >= 2) {
        assert.equal(plan.workflow, "special_occasion");
        assert.equal(plan.composition.bucketProfile, "plan_facets");
      }
      if (c.expectExact) {
        assert.notEqual(plan.composition.strategy, "grouped_sections");
      }
    });
  }

  if (c.pool) {
    check(`${c.id}: ask-fit pool`, () => {
      const pool = c.pool!.map(toBiz);
      const kept = filterForQuery(c.query, pool, c);
      const keptIds = kept.map((b) => b.id).sort();

      if (c.expectKeepIds) {
        assert.deepEqual(keptIds, [...c.expectKeepIds].sort());
      }
      if (c.expectDropIds) {
        for (const id of c.expectDropIds) {
          assert.ok(!keptIds.includes(id), `should drop ${id}`);
        }
      }
      if (c.allowEmpty && (c.expectKeepIds?.length ?? 0) === 0) {
        assert.equal(kept.length, 0);
      }

      for (const b of kept) {
        const hay = `${b.category ?? ""} ${b.name}`.toLowerCase();
        for (const bad of c.forbidCategorySubstrings ?? []) {
          assert.ok(
            !hay.includes(bad.toLowerCase()),
            `kept ${b.name} matches forbid "${bad}"`,
          );
        }
      }
    });
  }
}

console.log(`\n${passed} checks passed.`);
if (failures.length > 0) {
  console.error(`\n${failures.length} failed.`);
  process.exit(1);
}

console.log(`
Process:
  1. When a live reply is wrong, add a case to evals/reply-accuracy.json
  2. Run npm run verify:replies (also via npm run eval:smoke)
  3. Fix guard/filters until green — do not ship with red cases
`);
