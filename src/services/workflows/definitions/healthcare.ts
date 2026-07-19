import type { WorkflowDefinition } from "@/services/planner/types";

export const healthcareDefinition: WorkflowDefinition = {
  id: "healthcare",
  purpose: "Find non-emergency healthcare providers",
  requiredFields: ["care_type"],
  optionalFields: [],
  clarify: {
    care_type: "Do you need a GP, dentist, pharmacy, or specialist?",
  },
  defaultExecutionPlan: [
    {
      id: "healthcare_search",
      capability: "business_search",
      type: "business_search",
      query: "doctors and medical clinics",
      params: { verticalHint: "healthcare", limit: 12 },
      priority: 1,
      optional: false,
    },
  ],
  rankConfig: { quality: 0.1, limit: 12 },
  responseBehaviour: {
    allowExecuteWithoutRequired: true,
    emptyResultsMessage:
      "I couldn't find healthcare listings yet. Try GP, dentist, or pharmacy.",
  },
  defaultCompositionStrategy: "ranked_list",
};
