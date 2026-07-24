import type { BusinessResult } from "@/lib/schemas/business";
import { extractAttributes } from "@/lib/schemas/business-attributes";
import { verticalIntentScore } from "@/lib/business-vertical-filter";
import { isBeachLike, activityBucket } from "@/services/composition/strategies/activity-buckets";
import type {
  ConstraintModel,
  EntityModel,
  LocationRef,
  PlannerPlan,
} from "@/services/planner/types";
import { budgetToPriceLevel } from "@/services/planner/budget";
import { haversineMeters } from "@/services/planner/location-ref";
import { afterHoursAffinityScore } from "@/services/planner/trade-query";
import { ELEVATED_CASUAL_CHAIN_RE } from "@/services/planner/special-occasion-intent";
import { mealTimeFitScore } from "@/services/planner/meal-time-intent";
import {
  countAttributes,
  qualityScoreFromMetadata,
} from "./business-quality";

/** After-hours / emergencyCallOut boosts are for trades — not GPs or hospitals. */
const MEDICAL_OPEN_NOW_HINTS = new Set([
  "doctors",
  "hospitals",
  "healthcare",
  "dentists",
  "pharmacies",
  "optometrists",
  "physio",
  "vets",
]);

export interface RankConfig {
  similarity: number;
  rating: number;
  popularity: number;
  typeBoost: number;
  attributeBoost: number;
  keywordBoost: number;
  quality: number;
  distance: number;
  price: number;
  /** Hard ceiling — never a fill target. Weak scores are dropped first. */
  limit: number;
  /**
   * Absolute score floor (0–100). Results below this are dropped unless
   * needed to reach `minKeep`.
   */
  minScore?: number;
  /**
   * Keep a result if score >= topScore * relativeFloor (0–1).
   * Stops padding the list with weak near-misses up to `limit`.
   */
  relativeFloor?: number;
  /** Always keep at least this many after sorting (when available). */
  minKeep?: number;
  /**
   * Prefer cross-category variety (round-robin) so the first reply isn't
   * dominated by near-duplicate top similarity hits.
   */
  preferVariety?: boolean;
  /**
   * Workflow vertical hint (e.g. "attractions"). Off-intent businesses are
   * hard-demoted so they cannot outrank leisure matches on rating alone.
   */
  verticalHint?: string | null;
  /**
   * Soft weather lean from applyWeatherBiasToPlan — boosts outdoor/indoor
   * among matches without excluding anything.
   */
  weatherBias?: "favor_outdoor" | "favor_indoor" | "neutral" | null;
}

export const DEFAULT_RANK_CONFIG: RankConfig = {
  similarity: 0.38,
  rating: 0.12,
  popularity: 0.07,
  typeBoost: 0.07,
  attributeBoost: 0.07,
  keywordBoost: 0.12,
  quality: 0.09,
  distance: 0.1,
  price: 0.05,
  limit: 25,
  minScore: 12,
  relativeFloor: 0.45,
  minKeep: 6,
  preferVariety: true,
};

export type RankedBusiness = BusinessResult;

export interface RankContext {
  locationRef: LocationRef | null;
  entities: EntityModel;
  constraints: ConstraintModel;
}

function flagMatch(
  want: boolean | null,
  have: boolean | null | undefined,
): boolean | null {
  if (want !== true) return null;
  if (have === true) return true;
  if (have === false) return false;
  return null;
}

function attributeMatchScore(
  business: BusinessResult,
  constraints: ConstraintModel,
): number {
  const attrs = extractAttributes(business.metadata);
  const checks: (boolean | null)[] = [];

  const pairs: [boolean | null, boolean | null | undefined][] = [
    [constraints.required.familyFriendly, attrs.familyFriendly],
    [constraints.preferred.familyFriendly, attrs.familyFriendly],
    [constraints.required.romantic, attrs.romantic],
    [constraints.preferred.romantic, attrs.romantic],
    [constraints.required.petFriendly, attrs.petFriendly],
    [constraints.preferred.petFriendly, attrs.petFriendly],
    [constraints.required.outdoorSeating, attrs.outdoorSeating],
    [constraints.preferred.outdoorSeating, attrs.outdoorSeating],
    [constraints.preferred.seaView, attrs.seaView],
    [constraints.preferred.parking, attrs.parking],
    [constraints.preferred.wheelchairAccessible, attrs.wheelchair],
    [constraints.preferred.kidsArea, attrs.kidsArea],
    [constraints.preferred.breakfast, attrs.breakfast],
    [constraints.preferred.quiet, attrs.noiseLevel === "quiet"],
    [constraints.preferred.rainFriendly, attrs.rainFriendly],
    [constraints.required.rainFriendly, attrs.rainFriendly],
  ];

  for (const [want, have] of pairs) {
    checks.push(flagMatch(want, have ?? null));
  }

  if (
    constraints.preferred.outdoorSeating === true ||
    constraints.required.outdoorSeating === true
  ) {
    checks.push(
      attrs.outdoorSeating === true || attrs.seaView === true ? true : null,
    );
  }

  // Soft-OR: rain-friendly OR not outdoor (indoor-leaning) when weather bias asks.
  if (constraints.preferred.rainFriendly === true) {
    checks.push(
      attrs.rainFriendly === true || attrs.outdoorSeating !== true
        ? true
        : attrs.outdoorSeating === true
          ? false
          : null,
    );
  }

  const known = checks.filter((c) => c !== null) as boolean[];
  if (known.length === 0) return 0;

  // Avoid flags: soft penalty if matched
  let avoidPenalty = 0;
  if (constraints.avoid.quiet === true && attrs.noiseLevel === "quiet") {
    // user avoids quiet? rare
  }
  if (constraints.avoid.romantic === true && attrs.romantic === true) {
    avoidPenalty = 0.3;
  }

  const hits = known.filter(Boolean).length;
  return Math.max(0, hits / known.length - avoidPenalty);
}

function typeMatchScore(business: BusinessResult, entities: EntityModel): number {
  const haystack = [
    business.category ?? "",
    business.name,
    business.description ?? "",
  ]
    .join(" ")
    .toLowerCase();

  const needles = [...entities.businessTypes, ...entities.cuisines].map((s) =>
    s.toLowerCase(),
  );
  if (needles.length === 0) return 0;

  let hits = 0;
  for (const n of needles) {
    if (!n) continue;
    if (
      haystack.includes(n) ||
      (n.includes("coffee") && haystack.includes("cafe")) ||
      (n.includes("cafe") && haystack.includes("coffee"))
    ) {
      hits += 1;
    }
  }
  return Math.min(hits / needles.length, 1);
}

function metaStringList(
  metadata: Record<string, unknown> | undefined,
  key: "services" | "keywords",
): string[] {
  const raw = metadata?.[key];
  if (!Array.isArray(raw)) return [];
  return raw.filter((s): s is string => typeof s === "string" && s.length > 0);
}

function tokenizeQueryNeedles(phrases: string[]): string[] {
  const out = new Set<string>();
  for (const phrase of phrases) {
    const lower = phrase.toLowerCase().trim();
    if (!lower) continue;
    out.add(lower);
    for (const token of lower.split(/[^a-z0-9+]+/i)) {
      if (token.length >= 3) out.add(token);
    }
  }
  return [...out];
}

function collectKeywordPhrases(
  entities: EntityModel,
  plan: PlannerPlan | RankContext,
): string[] {
  const phrases = [...entities.businessTypes, ...entities.cuisines];
  if ("executionPlan" in plan && Array.isArray(plan.executionPlan)) {
    for (const step of plan.executionPlan) {
      if (step.query) phrases.push(step.query);
    }
  }
  if ("goal" in plan && plan.goal?.description) {
    phrases.push(plan.goal.description);
  }
  if ("intent" in plan && typeof plan.intent === "string") {
    phrases.push(plan.intent);
  }
  return phrases;
}

/** Lexical overlap between planner signals and extracted services/keywords. */
function keywordMatchScore(
  business: BusinessResult,
  entities: EntityModel,
  plan: PlannerPlan | RankContext,
): number {
  const needles = tokenizeQueryNeedles(collectKeywordPhrases(entities, plan));
  if (needles.length === 0) return 0;

  const services = metaStringList(business.metadata, "services");
  const keywords = metaStringList(business.metadata, "keywords");
  const corpus = [...services, ...keywords].map((s) => s.toLowerCase());
  if (corpus.length === 0) return 0;

  let hits = 0;
  for (const needle of needles) {
    const matched = corpus.some(
      (term) =>
        term === needle ||
        term.includes(needle) ||
        needle.includes(term) ||
        term.split(/\s+/).includes(needle),
    );
    if (matched) hits += 1;
  }
  return Math.min(hits / needles.length, 1);
}

function distanceScore(
  business: BusinessResult,
  locationRef: LocationRef | null,
  radiusMeters: number | null,
): number | null {
  if (!locationRef || locationRef.lat == null || locationRef.lng == null) {
    return null; // do not score — no city-centre fallback
  }
  if (business.lat == null || business.lng == null) return null;

  const d = haversineMeters(
    locationRef.lat,
    locationRef.lng,
    business.lat,
    business.lng,
  );
  const radius = radiusMeters && radiusMeters > 0 ? radiusMeters : 8000;
  return Math.max(0, 1 - Math.min(d / radius, 1));
}

function priceScore(
  business: BusinessResult,
  constraints: ConstraintModel,
): number {
  const target = budgetToPriceLevel(constraints.budget);
  if (target == null || business.priceLevel == null) return 0;
  const diff = Math.abs(business.priceLevel - target);
  return Math.max(0, 1 - diff / 4);
}

/** Soft boost for portal-complete / search-ingested listings (never overrides intent). */
export function applyOwnerProfileBoost(
  score: number,
  metadata: Record<string, unknown> | undefined | null,
): number {
  if (!metadata || score <= 0) return score;
  const claimed = metadata.portalClaimed === true;
  const ingested = metadata.searchIngested === true;
  const complete = metadata.ownerProfileComplete === true;
  let bump = 0;
  if (claimed && ingested && complete) bump = 7;
  else if (ingested && complete) bump = 5;
  else if (complete) bump = 3;
  else if (ingested) bump = 2;
  else if (claimed) bump = 1;
  if (bump === 0) return score;
  return Math.min(100, Math.round((score + bump) * 10) / 10);
}

/**
 * Deterministic ranking from PlannerPlan signals.
 * Distance only when LocationRef has coordinates — never city centre.
 */
export function rankBusinesses(
  candidates: BusinessResult[],
  plan: PlannerPlan | RankContext,
  config: Partial<RankConfig> = {},
): RankedBusiness[] {
  const cfg = { ...DEFAULT_RANK_CONFIG, ...config };
  const constraints =
    "constraints" in plan && "version" in plan
      ? (plan as PlannerPlan).constraints
      : (plan as RankContext).constraints;
  const entities =
    "entities" in plan && "version" in plan
      ? (plan as PlannerPlan).entities
      : (plan as RankContext).entities;
  const locationRef =
    "locationRef" in plan
      ? (plan as PlannerPlan).locationRef
      : (plan as RankContext).locationRef;

  let weightSum =
    cfg.similarity +
    cfg.rating +
    cfg.popularity +
    cfg.typeBoost +
    cfg.attributeBoost +
    cfg.keywordBoost +
    cfg.quality +
    cfg.price;

  const ranked = candidates.map((b) => {
    const similarity = b.similarity ?? 0;
    const ratingScore = b.rating != null ? b.rating / 5 : 0;
    const popularity = Math.min((b.ratingCount ?? 0) / 500, 1);
    const typeScore = typeMatchScore(b, entities);
    const attrScore = attributeMatchScore(b, constraints);
    const keywordScore = keywordMatchScore(b, entities, plan);
    const q =
      qualityScoreFromMetadata(b.metadata) ||
      Math.min(100, countAttributes(b.metadata) * 8);
    const qualityNorm = q / 100;
    const price = priceScore(b, constraints);
    const dist = distanceScore(
      b,
      locationRef,
      constraints.distanceMeters,
    );

    let distWeight = 0;
    let distComponent = 0;
    if (dist != null) {
      distWeight = cfg.distance;
      distComponent = dist * cfg.distance;
    }

    const denom = weightSum + distWeight || 1;
    const raw =
      (similarity * cfg.similarity +
        ratingScore * cfg.rating +
        popularity * cfg.popularity +
        typeScore * cfg.typeBoost +
        attrScore * cfg.attributeBoost +
        keywordScore * cfg.keywordBoost +
        qualityNorm * cfg.quality +
        price * cfg.price +
        distComponent) /
      denom;

    const intent = verticalIntentScore(b, cfg.verticalHint);
    let score =
      Math.round(Math.min(Math.max(raw * intent, 0), 1) * 1000) / 10;

    // Prefer claimed + completed + search-ingested owner profiles among equals.
    score = applyOwnerProfileBoost(score, b.metadata);

    // Prefer listings that advertise after-hours / 24hr / call-out when asked.
    // Skip trade "emergency" affinity for medical asks — vet hospitals advertise
    // emergency heavily and used to outrank human GPs for "doctor open now".
    if (constraints.openNow === true) {
      const medicalAsk = MEDICAL_OPEN_NOW_HINTS.has(
        (cfg.verticalHint ?? "").toLowerCase(),
      );
      if (!medicalAsk) {
        const affinity = afterHoursAffinityScore(b);
        if (affinity > 0) {
          score = Math.min(100, Math.round((score + affinity * 22) * 10) / 10);
        }
        const attrs = extractAttributes(b.metadata);
        if (attrs.lateNight === true) {
          score = Math.min(100, Math.round((score + 6) * 10) / 10);
        }
        if (attrs.emergencyCallOut === true || attrs.afterHours === true) {
          score = Math.min(100, Math.round((score + 8) * 10) / 10);
        }
        if (attrs.open24Hours === true) {
          score = Math.min(100, Math.round((score + 5) * 10) / 10);
        }
      }
      if (b.phone) {
        score = Math.min(100, Math.round((score + 3) * 10) / 10);
      }
    }
    // Weather soft boosts — prioritize among already-relevant matches, never drop.
    const weatherBias = cfg.weatherBias ?? null;
    const relevantEnough =
      typeScore >= 0.25 || keywordScore >= 0.2 || similarity >= 0.42;
    if (weatherBias === "favor_indoor") {
      const attrs = extractAttributes(b.metadata);
      if (relevantEnough && attrs.rainFriendly === true) {
        score = Math.min(100, Math.round((score + 10) * 10) / 10);
      } else if (attrs.rainFriendly === true) {
        score = Math.min(100, Math.round((score + 3) * 10) / 10);
      }
      if (attrs.outdoorSeating === true && relevantEnough) {
        score = Math.max(0, Math.round((score - 4) * 10) / 10);
      }
      if (isBeachLike(b)) {
        score = Math.max(0, Math.round((score * 0.45 - 4) * 10) / 10);
      }
    } else if (weatherBias === "favor_outdoor") {
      const attrs = extractAttributes(b.metadata);
      const outdoorFit =
        attrs.outdoorSeating === true || attrs.seaView === true;
      if (relevantEnough && outdoorFit) {
        score = Math.min(100, Math.round((score + 12) * 10) / 10);
        if (attrs.seaView === true) {
          score = Math.min(100, Math.round((score + 4) * 10) / 10);
        }
      } else if (outdoorFit) {
        // Tiny nudge only — weather must not promote off-ask sea-view spots.
        score = Math.min(100, Math.round((score + 2) * 10) / 10);
      }
      // Beaches stay discoverable but are not boosted to the top on sunny days.
    } else if (constraints.preferred.rainFriendly === true) {
      // Legacy path if caller still sets rainFriendly preferred.
      const attrs = extractAttributes(b.metadata);
      if (attrs.rainFriendly === true) {
        score = Math.min(100, Math.round((score + 12) * 10) / 10);
      }
      if (attrs.outdoorSeating === true) {
        score = Math.max(0, Math.round((score - 8) * 10) / 10);
      }
      if (isBeachLike(b)) {
        score = Math.max(0, Math.round((score * 0.2 - 12) * 10) / 10);
      }
    } else if (constraints.preferred.outdoorSeating === true) {
      const attrs = extractAttributes(b.metadata);
      if (attrs.outdoorSeating === true || attrs.seaView === true) {
        score = Math.min(100, Math.round((score + 6) * 10) / 10);
      }
      if (isBeachLike(b)) {
        score = Math.min(100, Math.round((score + 4) * 10) / 10);
      }
    }

    // Meal-time dining: hard boost sit-down breakfast; demote bakeries/bars/far suburbs.
    const mealPreferred =
      constraints.preferred.breakfast === true
        ? ("breakfast" as const)
        : constraints.preferred.lunch === true
          ? ("lunch" as const)
          : constraints.preferred.dinner === true
            ? ("dinner" as const)
            : null;
    if (mealPreferred) {
      const attrs = extractAttributes(b.metadata);
      const { fit, leanAgainst } = mealTimeFitScore(mealPreferred, {
        name: b.name,
        category: b.category,
        description: b.description,
        address: b.address,
        breakfast: attrs.breakfast,
      });
      if (fit >= 5) {
        score = Math.min(100, Math.round((score + 22) * 10) / 10);
      } else if (fit >= 3) {
        score = Math.min(100, Math.round((score + 14) * 10) / 10);
      } else if (fit >= 1) {
        score = Math.min(100, Math.round((score + 5) * 10) / 10);
      }
      if (leanAgainst) {
        score = Math.max(0, Math.round((score - 28) * 10) / 10);
      }
      if (mealPreferred === "breakfast" && attrs.breakfast === false) {
        score = Math.max(0, Math.round((score - 25) * 10) / 10);
      }
      // Weak breakfast signal + bakery/cake lean → sink further.
      if (leanAgainst && fit < 2) {
        score = Math.max(0, Math.round(score * 0.35 * 10) / 10);
      }
    }

    // Hard distance gate when the user anchored a place ("near me" / Ballito).
    if (
      locationRef?.lat != null &&
      locationRef.lng != null &&
      b.lat != null &&
      b.lng != null
    ) {
      const meters = haversineMeters(
        locationRef.lat,
        locationRef.lng,
        b.lat,
        b.lng,
      );
      const softRadius = constraints.distanceMeters ?? 10000;
      const hardRadius = Math.max(softRadius * 1.8, 18000);
      if (meters > hardRadius) {
        score = Math.max(0, Math.round(score * 0.12 * 10) / 10);
      } else if (meters > softRadius) {
        score = Math.max(0, Math.round((score - 12) * 10) / 10);
      }
    }

    // Celebration plans: soft audience bias from constraints + facets (not a fixed checklist).
    const celebrationActive =
      ("workflow" in plan &&
        (plan as PlannerPlan).workflow === "special_occasion") ||
      ("composition" in plan &&
        ((plan as PlannerPlan).composition?.bucketProfile === "plan_facets" ||
          (plan as PlannerPlan).composition?.bucketProfile ===
            "special_occasion"));
    if (celebrationActive) {
      const facets = ("composition" in plan
        ? (plan as PlannerPlan).composition?.planFacets
        : undefined) ?? [];
      const familyLean =
        constraints.preferred.familyFriendly === true ||
        constraints.preferred.kidsArea === true;
      const romanticLean = constraints.preferred.romantic === true;
      const elevatedLean =
        constraints.budget === "upscale" || constraints.budget === "luxury";

      const attrs = extractAttributes(b.metadata);
      if (romanticLean && attrs.romantic === true) {
        score = Math.min(100, Math.round((score + 8) * 10) / 10);
      }
      if (romanticLean && attrs.seaView === true) {
        score = Math.min(100, Math.round((score + 4) * 10) / 10);
      }
      if (familyLean && (attrs.familyFriendly === true || attrs.kidsArea === true)) {
        score = Math.min(100, Math.round((score + 8) * 10) / 10);
      }

      // Soft demote jewellery on family plans unless a facet asks for it.
      const allowJewellery = facets.some(
        (f) =>
          f.verticalHint === "jewellery" ||
          /jewell|ring|diamond/i.test(`${f.label} ${f.searchQuery}`),
      );
      const hay = `${b.name} ${b.category ?? ""} ${b.description ?? ""}`.toLowerCase();
      if (
        familyLean &&
        !allowJewellery &&
        /\bjewell|diamond\s*buyer|engagement\s*ring\b/i.test(hay)
      ) {
        score = Math.max(0, Math.round((score * 0.2 - 15) * 10) / 10);
      }

      const allowKidsPlay =
        familyLean ||
        facets.some((f) =>
          /kids|play|party|laser|arcade|trampoline/i.test(
            `${f.label} ${f.searchQuery}`,
          ),
        );
      if (
        romanticLean &&
        !allowKidsPlay &&
        /\blaser\s*tag|go[\s-]?kart|arcade|playground|soft\s*play\b/i.test(hay)
      ) {
        score = Math.max(0, Math.round((score * 0.2 - 15) * 10) / 10);
      }

      // Elevated celebrations: prefer occasion-register dining, soft-demote casual.
      const ownFacetId =
        typeof b.metadata?.planFacetId === "string"
          ? b.metadata.planFacetId
          : null;
      const ownFacet = ownFacetId
        ? facets.find((f) => f.id === ownFacetId)
        : undefined;
      const ownFacetHay = ownFacet
        ? `${ownFacet.label} ${ownFacet.searchQuery} ${ownFacet.verticalHint ?? ""}`
        : "";
      const fromDiningFacet =
        /restaurant|dinner|dining|brunch|cocktail|bar|wine|meal|celebrate/i.test(
          ownFacetHay,
        ) ||
        ownFacet?.verticalHint === "restaurants" ||
        ownFacet?.verticalHint === "nightlife";
      const diningLike =
        fromDiningFacet ||
        /restaurant|dining|dinner|cafe|bistro|grill|steak|seafood|cocktail|wine\s*bar|\bbar\b|brunch/i.test(
          hay,
        );

      if (elevatedLean && diningLike && !familyLean) {
        if (attrs.reservations === true || attrs.bookingRequired === true) {
          score = Math.min(100, Math.round((score + 5) * 10) / 10);
        }
        if (attrs.cocktails === true || attrs.wineSelection === true) {
          score = Math.min(100, Math.round((score + 4) * 10) / 10);
        }
        if (attrs.romantic === true) {
          score = Math.min(100, Math.round((score + 4) * 10) / 10);
        }
        if (attrs.seaView === true) {
          score = Math.min(100, Math.round((score + 3) * 10) / 10);
        }
        if (attrs.noiseLevel === "quiet") {
          score = Math.min(100, Math.round((score + 3) * 10) / 10);
        }
        if (b.priceLevel != null && b.priceLevel <= 1) {
          score = Math.max(0, Math.round((score * 0.75 - 5) * 10) / 10);
        }
        if (
          attrs.takeaway === true &&
          (b.ratingCount ?? 0) > 800 &&
          (b.priceLevel == null || b.priceLevel <= 2)
        ) {
          score = Math.max(0, Math.round((score * 0.85 - 3) * 10) / 10);
        }
        if (ELEVATED_CASUAL_CHAIN_RE.test(hay)) {
          score = Math.max(0, Math.round((score * 0.15 - 20) * 10) / 10);
        } else if (
          /\bburger|fast\s*food|drive[\s-]?thru|take[\s-]?away\s*joint\b/i.test(
            hay,
          ) &&
          (b.priceLevel == null || b.priceLevel <= 2)
        ) {
          score = Math.max(0, Math.round((score * 0.55 - 8) * 10) / 10);
        }
      }
    }

    // "Best restaurants" / dining browse: demote QSR chains so they don't fill vibes.
    if (cfg.verticalHint === "restaurants") {
      const askHay = collectKeywordPhrases(entities, plan).join(" ");
      const qualityAsk =
        /\b(best|top|finest|greatest|must[\s-]?try|recommend(?:ed)?)\b/i.test(
          askHay,
        );
      const diningHay = `${b.name} ${b.category ?? ""}`.toLowerCase();
      if (ELEVATED_CASUAL_CHAIN_RE.test(diningHay)) {
        score = qualityAsk
          ? Math.max(0, Math.round((score * 0.18 - 18) * 10) / 10)
          : Math.max(0, Math.round((score * 0.5 - 8) * 10) / 10);
      }
    }

    return { ...b, score };
  });

  ranked.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  // For activities: keep the best beach, demote the rest so they don't fill the top.
  const diversified =
    cfg.verticalHint === "attractions" || cfg.verticalHint === "family"
      ? demoteDuplicateBeaches(ranked)
      : ranked;

  diversified.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  const withVertical =
    cfg.verticalHint != null && cfg.verticalHint !== ""
      ? diversified.filter((b) => (b.score ?? 0) >= 5)
      : diversified;

  const mealFiltered = filterMealMisfits(withVertical, constraints);

  // Score floor while still sorted, then diversify so first reply isn't a popularity cluster.
  const eligible = filterByScoreFloor(mealFiltered, cfg);
  if (cfg.preferVariety === false) {
    return eligible.slice(0, Math.max(1, cfg.limit));
  }
  return selectDiverseRoundRobin(eligible, Math.max(1, cfg.limit));
}

/**
 * Drop cake shops / coffee stands / far suburbs when we already have enough
 * real breakfast (or lunch/dinner) matches.
 */
function filterMealMisfits(
  ranked: RankedBusiness[],
  constraints: ConstraintModel,
): RankedBusiness[] {
  const meal =
    constraints.preferred.breakfast === true
      ? ("breakfast" as const)
      : constraints.preferred.lunch === true
        ? ("lunch" as const)
        : constraints.preferred.dinner === true
          ? ("dinner" as const)
          : null;
  if (!meal || ranked.length === 0) return ranked;

  const annotated = ranked.map((b) => {
    const attrs = extractAttributes(b.metadata);
    const { fit, leanAgainst } = mealTimeFitScore(meal, {
      name: b.name,
      category: b.category,
      description: b.description,
      address: b.address,
      breakfast: attrs.breakfast,
    });
    return { b, fit, leanAgainst };
  });

  const keepers = annotated.filter((x) => !x.leanAgainst || x.fit >= 3);
  if (keepers.length >= 3) return keepers.map((x) => x.b);
  return ranked;
}

/** Keep strong matches; stop when scores fall off the top (ceiling, not quota). */
function filterByScoreFloor(
  ranked: RankedBusiness[],
  cfg: RankConfig,
): RankedBusiness[] {
  if (ranked.length === 0) return [];

  const minKeep = Math.min(cfg.minKeep ?? 6, ranked.length);
  const minScore = cfg.minScore ?? 12;
  const relativeFloor = cfg.relativeFloor ?? 0.45;
  const top = ranked[0]?.score ?? 0;
  const floor = Math.max(minScore, top * relativeFloor);

  const kept: RankedBusiness[] = [];
  for (const b of ranked) {
    const score = b.score ?? 0;
    if (kept.length < minKeep || score >= floor) {
      kept.push(b);
      continue;
    }
    break;
  }
  return kept;
}

/**
 * Round-robin across coarse buckets so popular near-duplicates don't monopolise
 * the first reply (the Try-again effect users preferred).
 */
function selectDiverseRoundRobin(
  ranked: RankedBusiness[],
  limit: number,
): RankedBusiness[] {
  if (ranked.length <= limit) return ranked;

  const queues = new Map<string, RankedBusiness[]>();
  for (const b of ranked) {
    const key = diversityKey(b);
    const list = queues.get(key) ?? [];
    list.push(b);
    queues.set(key, list);
  }

  const buckets = [...queues.values()];
  const out: RankedBusiness[] = [];
  const seen = new Set<string>();
  let madeProgress = true;

  while (out.length < limit && madeProgress) {
    madeProgress = false;
    for (const bucket of buckets) {
      while (bucket.length > 0 && seen.has(bucket[0]!.id)) {
        bucket.shift();
      }
      const next = bucket.shift();
      if (!next) continue;
      out.push(next);
      seen.add(next.id);
      madeProgress = true;
      if (out.length >= limit) break;
    }
  }

  return out;
}

function diversityKey(b: RankedBusiness): string {
  const activity = activityBucket(b);
  if (activity) return activity;
  const cat = (b.category ?? "other").toLowerCase().split(/[/|,]/)[0]?.trim();
  return cat && cat.length > 0 ? cat : "other";
}

/** Keep #1 beach at full score; crush near-duplicate beaches down the list. */
function demoteDuplicateBeaches(ranked: RankedBusiness[]): RankedBusiness[] {
  let beachCount = 0;
  return ranked.map((b) => {
    if (!isBeachLike(b)) return b;
    beachCount += 1;
    if (beachCount === 1) return b;
    const factor = beachCount === 2 ? 0.45 : 0.25;
    const score = Math.round((b.score ?? 0) * factor * 10) / 10;
    return { ...b, score };
  });
}
