import type { WorkflowDefinition } from "@/services/planner/types";

/** Facets from the planner drive search — empty default until resolver fills steps. */
export const specialOccasionDefinition: WorkflowDefinition = {
  id: "special_occasion",
  purpose:
    "Plan celebrations and life events using dynamic planner facets",
  requiredFields: [],
  optionalFields: [],
  clarify: {},
  defaultExecutionPlan: [],
  rankConfig: {
    attributeBoost: 0.14,
    typeBoost: 0.12,
    keywordBoost: 0.16,
    similarity: 0.28,
    quality: 0.1,
    limit: 24,
    preferVariety: true,
    minKeep: 8,
  },
  responseBehaviour: {
    allowExecuteWithoutRequired: true,
    emptyResultsMessage:
      "I couldn't find enough local options for that celebration yet. Tell me what matters most — venue, cake, dinner, or something else.",
  },
  defaultCompositionStrategy: "grouped_sections",
};
