import type { WorkflowDefinition } from "@/services/planner/types";

export const activitiesDefinition: WorkflowDefinition = {
  id: "activities",
  purpose: "Find things to do, beaches, and attractions",
  requiredFields: ["activity_hint"],
  optionalFields: [],
  clarify: {
    activity_hint:
      "Are you looking for beaches, family fun, outdoor adventure, or something else?",
  },
  defaultExecutionPlan: [
    {
      id: "activities_search",
      capability: "business_search",
      type: "business_search",
      query: "beaches outdoor attractions experiences family activities",
      params: { verticalHint: "attractions", limit: 30 },
      priority: 1,
      optional: false,
    },
  ],
  rankConfig: {
    attributeBoost: 0.12,
    typeBoost: 0.18,
    keywordBoost: 0.14,
    similarity: 0.32,
    quality: 0.08,
    limit: 25,
  },
  responseBehaviour: {
    allowExecuteWithoutRequired: false,
    emptyResultsMessage:
      "I couldn't find matching activities yet. Tell me what kind of day you want.",
  },
  defaultCompositionStrategy: "grouped_sections",
};
