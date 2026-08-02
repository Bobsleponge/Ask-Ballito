/**
 * Universal hard-constraint eligibility.
 * Required dims are gates (unknown ≠ true). Preferred dims stay ranking-only.
 */

import type { BusinessResult } from "@/lib/schemas/business";
import {
  extractAttributes,
  type BusinessAttributes,
} from "@/lib/schemas/business-attributes";
import type {
  ConstraintFlags,
  ConstraintModel,
  EnvironmentConstraint,
} from "./types";

export type EligibilityDropReason =
  | `required:${keyof ConstraintFlags}`
  | "environment:outdoor"
  | "environment:indoor";

export type EligibilityResult = {
  eligible: BusinessResult[];
  dropped: Array<{ id: string; name: string; reasons: EligibilityDropReason[] }>;
  /** True when at least one required gate was active. */
  hadHardRequirements: boolean;
};

/** Constraint flags with a direct boolean attribute mapping. */
const FLAG_ATTR: Partial<
  Record<keyof ConstraintFlags, keyof BusinessAttributes>
> = {
  outdoorSeating: "outdoorSeating",
  seaView: "seaView",
  familyFriendly: "familyFriendly",
  romantic: "romantic",
  petFriendly: "petFriendly",
  parking: "parking",
  wheelchairAccessible: "wheelchair",
  kidsArea: "kidsArea",
  breakfast: "breakfast",
  rainFriendly: "rainFriendly",
  outdoorPlay: "outdoorPlay",
  indoorPlay: "indoorPlay",
  wifi: "wifi",
};

/** Any required flag or environment that must be enforced as eligibility. */
export function hasHardEligibilityRequirements(
  constraints: ConstraintModel,
): boolean {
  if (constraints.environmentRequired != null) return true;
  const req = constraints.required;
  for (const key of Object.keys(req) as (keyof ConstraintFlags)[]) {
    if (req[key] != null) return true;
  }
  return false;
}

function attrEvidence(
  attrs: BusinessAttributes,
  key: keyof ConstraintFlags,
): boolean | null {
  if (key === "quiet") {
    if (attrs.noiseLevel === "quiet") return true;
    if (attrs.noiseLevel === "lively" || attrs.noiseLevel === "moderate") {
      return false;
    }
    return null;
  }
  // Meal flags: breakfast has an attribute; lunch/dinner are soft / search-only today.
  if (key === "lunch" || key === "dinner") {
    return null;
  }
  const attrKey = FLAG_ATTR[key];
  if (!attrKey) return null;
  const v = attrs[attrKey];
  if (v === true) return true;
  if (v === false) return false;
  return null;
}

/**
 * Outdoor: need positive outdoor evidence (play or seating).
 * Indoor: need indoor play or rain-friendly evidence.
 * Unknown → null (fails hard requirements).
 */
export function environmentEvidence(
  env: EnvironmentConstraint,
  attrs: BusinessAttributes,
): boolean | null {
  if (env == null) return true;

  const outdoorPlay = attrs.outdoorPlay ?? null;
  const outdoorSeating = attrs.outdoorSeating ?? null;
  const indoorPlay = attrs.indoorPlay ?? null;
  const rainFriendly = attrs.rainFriendly ?? null;

  if (env === "outdoor") {
    const hasOutdoor = outdoorPlay === true || outdoorSeating === true;
    if (hasOutdoor) return true;
    const knownNotOutdoor =
      outdoorPlay === false && outdoorSeating === false;
    if (knownNotOutdoor) return false;
    if (indoorPlay === true) return false;
    return null;
  }

  // indoor
  const hasIndoor = indoorPlay === true || rainFriendly === true;
  if (hasIndoor) return true;
  if (outdoorPlay === true) return false;
  if (
    outdoorPlay === false &&
    indoorPlay === false &&
    rainFriendly === false
  ) {
    return false;
  }
  return null;
}

function evaluateCandidate(
  business: BusinessResult,
  constraints: ConstraintModel,
): EligibilityDropReason[] {
  const attrs = extractAttributes(business.metadata);
  const reasons: EligibilityDropReason[] = [];
  const req = constraints.required;

  for (const key of Object.keys(req) as (keyof ConstraintFlags)[]) {
    const want = req[key];
    if (want == null) continue;
    // lunch/dinner have no attribute evidence yet — skip hard gate (search concepts cover recall)
    if (key === "lunch" || key === "dinner") continue;
    const have = attrEvidence(attrs, key);
    if (want === true) {
      if (have !== true) reasons.push(`required:${key}`);
    } else if (have === true) {
      reasons.push(`required:${key}`);
    }
  }

  if (constraints.environmentRequired === "outdoor") {
    if (environmentEvidence("outdoor", attrs) !== true) {
      reasons.push("environment:outdoor");
    }
  } else if (constraints.environmentRequired === "indoor") {
    if (environmentEvidence("indoor", attrs) !== true) {
      reasons.push("environment:indoor");
    }
  }

  return reasons;
}

/**
 * Filter candidates by required constraints. Preferred flags are ignored here.
 */
export function filterByHardEligibility(
  candidates: BusinessResult[],
  constraints: ConstraintModel,
): EligibilityResult {
  const hadHardRequirements = hasHardEligibilityRequirements(constraints);

  if (!hadHardRequirements) {
    return { eligible: candidates, dropped: [], hadHardRequirements: false };
  }

  const eligible: BusinessResult[] = [];
  const dropped: EligibilityResult["dropped"] = [];

  for (const b of candidates) {
    const reasons = evaluateCandidate(b, constraints);
    if (reasons.length === 0) {
      eligible.push(b);
    } else {
      dropped.push({ id: b.id, name: b.name, reasons });
    }
  }

  return { eligible, dropped, hadHardRequirements: true };
}

/** Compact snapshot of required dims for QUERY_TRACE. */
export function summarizeRequiredConstraints(
  constraints: ConstraintModel,
): Record<string, boolean | string | null> {
  const out: Record<string, boolean | string | null> = {};
  for (const key of Object.keys(constraints.required) as (keyof ConstraintFlags)[]) {
    if (constraints.required[key] != null) {
      out[key] = constraints.required[key];
    }
  }
  if (constraints.environmentRequired != null) {
    out.environment = constraints.environmentRequired;
  }
  if (constraints.audienceRequired != null) {
    out.audience = constraints.audienceRequired;
  }
  return out;
}
