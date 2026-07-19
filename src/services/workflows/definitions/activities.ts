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
      query: "things to do and attractions",
      params: { verticalHint: "attractions", limit: 12 },
      priority: 1,
      optional: false,
    },
  ],
  rankConfig: { attributeBoost: 0.1, quality: 0.08, limit: 12 },
  responseBehaviour: {
    allowExecuteWithoutRequired: false,
    emptyResultsMessage:
      "I couldn't find matching activities yet. Tell me what kind of day you want.",
  },
  defaultCompositionStrategy: "grouped_sections",
};
