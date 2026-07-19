import type { WorkflowDefinition } from "@/services/planner/types";

export const servicesDefinition: WorkflowDefinition = {
  id: "services",
  purpose: "Find professional and local services",
  requiredFields: ["service_type"],
  optionalFields: [],
  clarify: {
    service_type:
      "What kind of service do you need — beauty, fitness, repairs, or something else?",
  },
  defaultExecutionPlan: [
    {
      id: "services_search",
      capability: "business_search",
      type: "business_search",
      query: "professional services",
      params: { verticalHint: "home-services", limit: 12 },
      priority: 1,
      optional: false,
    },
  ],
  rankConfig: { quality: 0.1, limit: 12 },
  responseBehaviour: {
    allowExecuteWithoutRequired: false,
    emptyResultsMessage:
      "I couldn't find matching services yet. What type of help do you need?",
  },
  defaultCompositionStrategy: "ranked_list",
};
