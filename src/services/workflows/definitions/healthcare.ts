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
      // Resolved per-ask in the planner (doctors / hospitals / …) — never leave
      // the broad family that previously mixed in veterinary care.
      params: { verticalHint: "doctors", limit: 30 },
      priority: 1,
      optional: false,
    },
  ],
  rankConfig: { quality: 0.1, limit: 25 },
  responseBehaviour: {
    allowExecuteWithoutRequired: true,
    emptyResultsMessage:
      "I couldn't find healthcare listings yet. Try GP, dentist, or pharmacy.",
  },
  defaultCompositionStrategy: "ranked_list",
};
