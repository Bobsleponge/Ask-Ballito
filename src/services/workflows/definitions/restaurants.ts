import type { WorkflowDefinition } from "@/services/planner/types";

export const restaurantsDefinition: WorkflowDefinition = {
  id: "restaurants",
  purpose: "Find restaurants, cafes, and dining experiences",
  requiredFields: ["place_type"],
  optionalFields: ["cuisine"],
  clarify: {
    place_type:
      "What type of place are you looking for — restaurant, cafe, or a specific cuisine?",
  },
  defaultExecutionPlan: [
    {
      id: "dining_search",
      capability: "business_search",
      type: "business_search",
      query: "restaurants and cafes",
      params: { verticalHint: "restaurants", limit: 30 },
      priority: 1,
      optional: false,
    },
  ],
  rankConfig: {
    attributeBoost: 0.12,
    typeBoost: 0.12,
    quality: 0.08,
    limit: 25,
  },
  responseBehaviour: {
    allowExecuteWithoutRequired: false,
    emptyResultsMessage:
      "I couldn't find matching places to eat yet. Try a cuisine or neighbourhood.",
  },
  defaultCompositionStrategy: "grouped_sections",
};
