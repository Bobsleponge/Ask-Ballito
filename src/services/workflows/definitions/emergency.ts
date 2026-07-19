import type { WorkflowDefinition } from "@/services/planner/types";

export const emergencyDefinition: WorkflowDefinition = {
  id: "emergency",
  purpose: "Provide emergency contacts without delay",
  requiredFields: [],
  optionalFields: [],
  clarify: {},
  defaultExecutionPlan: [
    {
      id: "emergency_contacts",
      capability: "static_dataset",
      type: "fast_path",
      query: "emergency",
      params: { dataset: "emergency_contacts" },
      priority: 1,
      optional: false,
    },
  ],
  rankConfig: { limit: 0 },
  responseBehaviour: {
    allowExecuteWithoutRequired: true,
    emptyResultsMessage: "Call 10111 or 10177 immediately if this is an emergency.",
    preferFastPathCapability: "static_dataset",
  },
  defaultCompositionStrategy: "ranked_list",
};
