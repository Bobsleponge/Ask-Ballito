import type { WorkflowDefinition } from "@/services/planner/types";

export const propertyDefinition: WorkflowDefinition = {
  id: "property",
  purpose: "Find estate agents and property-related services",
  requiredFields: ["property_intent"],
  optionalFields: [],
  clarify: {
    property_intent:
      "Are you buying, renting, or looking for an estate agent in a specific area?",
  },
  defaultExecutionPlan: [
    {
      id: "estate_agents",
      capability: "business_search",
      type: "business_search",
      query: "estate agents",
      params: { verticalHint: "property", limit: 30 },
      priority: 1,
      optional: false,
    },
  ],
  rankConfig: { quality: 0.1, limit: 25 },
  responseBehaviour: {
    allowExecuteWithoutRequired: false,
    emptyResultsMessage:
      "I couldn't find property contacts yet. Buying, renting, or a specific estate?",
  },
  defaultCompositionStrategy: "ranked_list",
};
