import type { WorkflowDefinition } from "@/services/planner/types";

export const servicesDefinition: WorkflowDefinition = {
  id: "services",
  purpose: "Find professional and local services",
  requiredFields: ["service_type"],
  optionalFields: [],
  clarify: {
    service_type:
      "What kind of service do you need — beauty, fitness, repairs, welding, or something else?",
  },
  defaultExecutionPlan: [
    {
      id: "services_search",
      capability: "business_search",
      type: "business_search",
      query: "professional services",
      // verticalHint is set per-ask in the planner resolver — never default to
      // home-services or plumbers dominate every trade query.
      params: { limit: 30 },
      priority: 1,
      optional: false,
    },
  ],
  rankConfig: { quality: 0.1, limit: 25 },
  responseBehaviour: {
    allowExecuteWithoutRequired: false,
    emptyResultsMessage:
      "I couldn't find a clear match for that service yet. Try naming the trade or job — for example plumber, electrician, welder, trailer fabrication, or a salon — and I'll look again.",
  },
  defaultCompositionStrategy: "ranked_list",
};
