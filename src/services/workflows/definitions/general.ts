import type { WorkflowDefinition } from "@/services/planner/types";

export const generalDefinition: WorkflowDefinition = {
  id: "general",
  purpose: "Greetings, FAQ, and unclear discovery asks",
  requiredFields: [],
  optionalFields: ["place_type"],
  clarify: {
    place_type:
      "What are you looking for in Ballito — food, things to do, a place to stay, or something else?",
  },
  defaultExecutionPlan: [
    {
      id: "faq",
      capability: "faq",
      type: "faq",
      query: "",
      params: {},
      priority: 1,
      optional: true,
    },
  ],
  rankConfig: { limit: 4, quality: 0.05 },
  responseBehaviour: {
    allowExecuteWithoutRequired: true,
    emptyResultsMessage:
      "Tell me what you need in Ballito and I'll find local options.",
    preferFastPathCapability: "faq",
  },
  defaultCompositionStrategy: "ranked_list",
};
