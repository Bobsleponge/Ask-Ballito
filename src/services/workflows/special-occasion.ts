import { buildSpecialOccasionSystem } from "@/lib/ai/prompts/workflows/special-occasion.v1";
import { buildClarificationMessage, defaultSearchQueries } from "./base";
import type { Workflow } from "./types";

export const specialOccasionWorkflow: Workflow = {
  id: "special_occasion",
  requiredFields: () => [],
  clarificationMessage: (plan) =>
    buildClarificationMessage(plan, [
      "What kind of celebration are you planning?",
    ]),
  searchStrategy: (plan) => ({
    queries: defaultSearchQueries(plan, [
      "celebration venues",
      "party ideas Ballito",
    ]),
    limitPerQuery: 8,
  }),
  rankConfig: { limit: 24, attributeBoost: 0.14, keywordBoost: 0.16 },
  promptName: "special_occasion",
  buildSystemPrompt: buildSpecialOccasionSystem,
};
