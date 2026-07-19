import { buildAccommodationSystem } from "@/lib/ai/prompts/workflows/accommodation.v1";
import { buildClarificationMessage, defaultSearchQueries } from "./base";
import type { Workflow } from "./types";

export const accommodationWorkflow: Workflow = {
  id: "accommodation",
  requiredFields: (plan) => {
    if (!plan.needsClarification) return [];
    return plan.searchQueries.length > 0
      ? []
      : ["Are you looking for a hotel, self-catering, or a short stay near the beach?"];
  },
  clarificationMessage: (plan) =>
    buildClarificationMessage(plan, [
      "Are you looking for a hotel, self-catering, or a short stay near the beach?",
    ]),
  searchStrategy: (plan) => ({
    queries: defaultSearchQueries(plan, ["hotels and accommodation"]),
    limitPerQuery: 12,
  }),
  rankConfig: { limit: 6 },
  promptName: "accommodation",
  buildSystemPrompt: buildAccommodationSystem,
};
