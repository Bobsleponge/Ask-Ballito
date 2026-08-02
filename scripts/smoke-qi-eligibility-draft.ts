/**
 * Smoke: QI → draft maps environment/audience into enforceable constraints;
 * hard-constrained composition avoids DISCOVERY activity buckets.
 */
import assert from "node:assert/strict";
import { queryIntelligenceToDraft } from "../src/services/planner/qi-to-draft";
import type { QueryIntelligenceResult } from "../src/lib/ai/prompts/query-intelligence.v1";
import { emptyConstraintFlags } from "../src/services/planner/types";
import { buildCompositionRequest } from "../src/services/composition/request";
import { hasHardEligibilityRequirements } from "../src/services/planner/eligibility";

function baseQi(
  overrides: Partial<QueryIntelligenceResult>,
): QueryIntelligenceResult {
  return {
    goal: { primary: "outdoor_kids", description: "Outdoor kids activities" },
    domains: ["activity"],
    entities: {
      locations: ["Ballito"],
      estates: [],
      landmarks: [],
      businessTypes: [],
      cuisines: [],
      dates: [],
      times: [],
      people: ["children"],
    },
    explicitConstraints: {
      ...emptyConstraintFlags(),
      familyFriendly: true,
    },
    implicitPreferences: emptyConstraintFlags(),
    explicitEnvironment: "outdoor",
    implicitEnvironment: null,
    hardExclusions: [],
    softPreferences: [],
    audience: "family_kids",
    locationIntent: { kind: "city", labels: ["Ballito"] },
    temporalIntent: { openNow: null, meal: null, when: null },
    desiredResultType: "ranked_list",
    facets: [],
    searchConcepts: ["outdoor playground", "adventure park", "farm activity"],
    diversityRequirements: { minDistinctConcepts: 2, avoidNearDuplicates: true },
    grouping: { strategy: "none", sectionLabels: [] },
    needsClarification: false,
    clarificationQuestion: null,
    confidence: 0.9,
    candidateWorkflows: ["activities"],
    ...overrides,
  };
}

const { draft } = queryIntelligenceToDraft(
  baseQi({}),
  "Outdoor activities for children around Ballito",
);

assert.equal(draft.constraints.environmentRequired, "outdoor");
assert.equal(draft.constraints.required.familyFriendly, true);
assert.equal(draft.constraints.audienceRequired, "family_kids");
assert.ok(hasHardEligibilityRequirements(draft.constraints));

const withHardFacet = queryIntelligenceToDraft(
  baseQi({
    facets: [
      {
        id: "outdoor_play",
        label: "Outdoor play",
        need: "outdoor kids play",
        searchConcepts: ["outdoor playground"],
        entityKinds: ["business"],
        verticalHint: "family",
        hard: true,
      },
    ],
  }),
  "Outdoor activities for children around Ballito",
);
assert.equal(withHardFacet.draft.planFacets[0]?.hard, true);

const { request, rules } = buildCompositionRequest({
  goalPrimary: draft.goal.primary,
  goalDescription: draft.goal.description,
  intent: draft.intent,
  workflowId: "activities",
  defaultStrategy: "grouped_sections",
  entities: draft.entities,
  constraints: draft.constraints,
  locationRef: null,
  planFacets: draft.planFacets,
});

assert.equal(request.strategy, "ranked_list");
assert.equal(request.bucketProfile, undefined);
assert.ok(rules.includes("composition_hard_constraints_ranked"));

// Unconstrained activities still get DISCOVERY buckets
const soft = buildCompositionRequest({
  goalPrimary: "weekend_fun",
  goalDescription: "Things to do",
  intent: "activity",
  workflowId: "activities",
  defaultStrategy: "grouped_sections",
  entities: draft.entities,
  constraints: {
    ...draft.constraints,
    required: emptyConstraintFlags(),
    environmentRequired: null,
    audienceRequired: null,
  },
  locationRef: null,
  planFacets: [],
});
assert.equal(soft.request.bucketProfile, "activities");

console.log("smoke-qi-eligibility-draft: ok");
