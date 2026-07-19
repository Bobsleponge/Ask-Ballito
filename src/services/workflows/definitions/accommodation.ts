import type { WorkflowDefinition } from "@/services/planner/types";

export const accommodationDefinition: WorkflowDefinition = {
  id: "accommodation",
  purpose: "Find hotels and places to stay",
  requiredFields: ["stay_type"],
  optionalFields: [],
  clarify: {
    stay_type:
      "Are you looking for a hotel, self-catering, or a short stay near the beach?",
  },
  defaultExecutionPlan: [
    {
      id: "stay_search",
      capability: "business_search",
      type: "business_search",
      query: "hotels and accommodation",
      params: { verticalHint: "hotels", limit: 12 },
      priority: 1,
      optional: false,
    },
  ],
  rankConfig: { quality: 0.1, limit: 12 },
  responseBehaviour: {
    allowExecuteWithoutRequired: false,
    emptyResultsMessage:
      "I couldn't find matching stays yet. Share hotel vs apartment and an area if you can.",
  },
  defaultCompositionStrategy: "ranked_list",
};
