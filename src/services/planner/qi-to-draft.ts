/**
 * Adapter: QueryIntelligenceResult → PlannerDraft (+ QI sidecar fields).
 * AI interprets; resolver/retrieval remain truth + enforcement.
 */

import type { QueryIntelligenceResult } from "@/lib/ai/prompts/query-intelligence.v1";
import type { ConstraintFlags, PlanFacet, PlannerDraft } from "./types";
import { emptyConstraintFlags, emptyConstraintModel, emptyEntityModel } from "./types";

export type QiSidecar = {
  searchConcepts: string[];
  hardExclusions: string[];
  softPreferences: string[];
  audience: QueryIntelligenceResult["audience"];
  domains: QueryIntelligenceResult["domains"];
  desiredResultType: QueryIntelligenceResult["desiredResultType"];
  needsClarification: boolean;
  clarificationQuestion: string | null;
  explicitEnvironment: QueryIntelligenceResult["explicitEnvironment"];
  implicitEnvironment: QueryIntelligenceResult["implicitEnvironment"];
};

function mergeFlags(
  explicit: ConstraintFlags,
  implicit: ConstraintFlags,
): { preferred: ConstraintFlags; required: ConstraintFlags } {
  const preferred = emptyConstraintFlags();
  const required = emptyConstraintFlags();
  const keys = Object.keys(preferred) as (keyof ConstraintFlags)[];
  for (const k of keys) {
    if (explicit[k] != null) {
      required[k] = explicit[k];
      preferred[k] = explicit[k];
    } else if (implicit[k] != null) {
      preferred[k] = implicit[k];
    }
  }
  return { preferred, required };
}

function facetToPlanFacet(
  facet: QueryIntelligenceResult["facets"][number],
): PlanFacet {
  const concepts = facet.searchConcepts.filter(Boolean);
  return {
    id: facet.id,
    label: facet.label,
    searchQuery: concepts.join(" ") || facet.need,
    verticalHint: facet.verticalHint,
    searchConcepts: concepts.length > 0 ? concepts : [facet.need],
    hard: facet.hard,
  };
}

/**
 * Map QI audience into enforceable required/avoid flags when not already set.
 */
function applyAudienceToConstraints(
  audience: QueryIntelligenceResult["audience"],
  required: ConstraintFlags,
  preferred: ConstraintFlags,
  avoid: ConstraintFlags,
): void {
  if (audience === "family_kids") {
    if (required.familyFriendly == null && preferred.familyFriendly == null) {
      required.familyFriendly = true;
      preferred.familyFriendly = true;
    }
    if (required.kidsArea == null && preferred.kidsArea == null) {
      // Soft lean toward kids-capable venues when audience is kids
      preferred.kidsArea = true;
    }
  } else if (audience === "adults_only") {
    if (required.kidsArea == null) {
      required.kidsArea = false;
    }
    preferred.kidsArea = false;
    preferred.familyFriendly = false;
    avoid.kidsArea = true;
  } else if (audience === "couple") {
    if (preferred.romantic == null && required.romantic == null) {
      preferred.romantic = true;
    }
  }
}

/**
 * Convert QI contract into a PlannerDraft the existing resolver understands.
 */
export function queryIntelligenceToDraft(
  qi: QueryIntelligenceResult,
  message: string,
): { draft: PlannerDraft; sidecar: QiSidecar } {
  const { preferred, required } = mergeFlags(
    qi.explicitConstraints,
    qi.implicitPreferences,
  );
  const avoid = emptyConstraintFlags();

  applyAudienceToConstraints(qi.audience, required, preferred, avoid);

  if (qi.temporalIntent.meal === "breakfast") preferred.breakfast = true;
  if (qi.temporalIntent.meal === "lunch") preferred.lunch = true;
  if (qi.temporalIntent.meal === "dinner") preferred.dinner = true;

  // Environment is enforced via constraints.environmentRequired (not outdoorSeating).
  // Play flags stay whatever QI emitted; soft lean only for preferred ranking.
  if (qi.explicitEnvironment === "outdoor" || qi.implicitEnvironment === "outdoor") {
    if (preferred.outdoorPlay == null) preferred.outdoorPlay = true;
  }
  if (qi.explicitEnvironment === "indoor" || qi.implicitEnvironment === "indoor") {
    if (preferred.rainFriendly == null && preferred.indoorPlay == null) {
      preferred.rainFriendly = true;
    }
  }

  const constraints = emptyConstraintModel();
  constraints.preferred = preferred;
  constraints.required = required;
  constraints.avoid = avoid;
  constraints.openNow = qi.temporalIntent.openNow;
  constraints.environmentRequired = qi.explicitEnvironment;
  constraints.environmentPreferred =
    qi.explicitEnvironment ?? qi.implicitEnvironment;
  constraints.audienceRequired =
    qi.audience === "unknown" ? null : qi.audience;

  if (qi.locationIntent.kind === "near_landmark" || qi.locationIntent.kind === "near_estate") {
    constraints.distanceLabel =
      qi.locationIntent.labels[0] != null
        ? `near ${qi.locationIntent.labels[0]}`
        : constraints.distanceLabel;
  }

  const facetConcepts = qi.facets.flatMap((f) => f.searchConcepts);
  const searchConcepts = uniqueStrings([
    ...qi.searchConcepts,
    ...facetConcepts,
  ]);

  const planFacets = qi.facets.map(facetToPlanFacet);
  const draftQueries =
    searchConcepts.length > 0
      ? searchConcepts.slice(0, 12)
      : message.trim()
        ? [message.slice(0, 120)]
        : [];

  const entities = emptyEntityModel();
  entities.locations = [...qi.entities.locations, ...qi.locationIntent.labels];
  entities.estates = [...qi.entities.estates];
  entities.landmarks = [...qi.entities.landmarks];
  entities.businessTypes = [...qi.entities.businessTypes];
  entities.cuisines = [...qi.entities.cuisines];
  entities.dates = [...qi.entities.dates];
  entities.times = [...qi.entities.times];
  entities.people = [...qi.entities.people];

  const sidecar: QiSidecar = {
    searchConcepts,
    hardExclusions: [...qi.hardExclusions],
    softPreferences: [...qi.softPreferences],
    audience: qi.audience,
    domains: [...qi.domains],
    desiredResultType: qi.desiredResultType,
    needsClarification: qi.needsClarification,
    clarificationQuestion: qi.clarificationQuestion,
    explicitEnvironment: qi.explicitEnvironment,
    implicitEnvironment: qi.implicitEnvironment,
  };

  const envNote =
    qi.explicitEnvironment != null
      ? `|env=${qi.explicitEnvironment}`
      : qi.implicitEnvironment != null
        ? `|env~=${qi.implicitEnvironment}`
        : "";

  const draft: PlannerDraft = {
    intent: qi.domains[0] ?? "business",
    goal: {
      primary: qi.goal.primary,
      description: qi.goal.description,
    },
    confidence: qi.confidence,
    candidateWorkflows: [...qi.candidateWorkflows],
    entities,
    constraints,
    draftQueries,
    planFacets,
    notes: `qi:v1|audience=${qi.audience}|result=${qi.desiredResultType}|exclusions=${qi.hardExclusions.join(",")}${envNote}`,
    searchConcepts,
    hardExclusions: [...qi.hardExclusions],
  };

  return { draft, sidecar };
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const key = v.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(v.trim());
  }
  return out;
}

export function isQiDraft(draft: PlannerDraft): boolean {
  return typeof draft.notes === "string" && draft.notes.startsWith("qi:");
}
