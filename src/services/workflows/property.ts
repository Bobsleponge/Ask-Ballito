import { buildPropertySystem } from "@/lib/ai/prompts/workflows/property.v1";
import { buildClarificationMessage, defaultSearchQueries } from "./base";
import type { Workflow } from "./types";

export const propertyWorkflow: Workflow = {
  id: "property",
  requiredFields: (plan) => {
    if (!plan.needsClarification) return [];
    return plan.entities.estates.length > 0 || plan.searchQueries.length > 0
      ? []
      : ["Are you buying, renting, or looking for an estate agent in a specific area?"];
  },
  clarificationMessage: (plan) =>
    buildClarificationMessage(plan, [
      "Are you buying, renting, or looking for an estate agent in a specific area?",
    ]),
  searchStrategy: (plan) => ({
    queries: defaultSearchQueries(plan, [
      "estate agents",
      "property and real estate",
    ]),
    limitPerQuery: 12,
  }),
  rankConfig: { limit: 6 },
  promptName: "property",
  buildSystemPrompt: buildPropertySystem,
};
