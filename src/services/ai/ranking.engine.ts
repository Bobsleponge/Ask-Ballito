import type { BusinessResult } from "@/lib/schemas/business";
import { extractAttributes } from "@/lib/schemas/business-attributes";
import type {
  ConstraintModel,
  EntityModel,
  LocationRef,
  PlannerPlan,
} from "@/services/planner/types";
import { budgetToPriceLevel } from "@/services/planner/budget";
import { haversineMeters } from "@/services/planner/location-ref";
import {
  countAttributes,
  qualityScoreFromMetadata,
} from "./business-quality";

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
  limit: number;
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
  limit: 12,
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

    const score = Math.round(Math.min(Math.max(raw, 0), 1) * 1000) / 10;
    return { ...b, score };
  });

  ranked.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  return ranked.slice(0, cfg.limit);
}
