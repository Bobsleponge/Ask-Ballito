import { matchFaq } from "@/config/local-knowledge";
import { buildGeneralSystem } from "@/lib/ai/prompts/workflows/general.v1";
import { buildClarificationMessage, defaultSearchQueries } from "./base";
import type { Workflow } from "./types";

export const generalWorkflow: Workflow = {
  id: "general",
  requiredFields: (plan) => {
    if (!plan.needsClarification) return [];
    return plan.missingInformation.length > 0
      ? plan.missingInformation
      : ["What are you looking for in Ballito — food, things to do, a place to stay, or something else?"];
  },
  clarificationMessage: (plan) =>
    buildClarificationMessage(plan, [
      "What are you looking for in Ballito — food, things to do, a place to stay, or something else?",
    ]),
  searchStrategy: (plan) => ({
    queries: defaultSearchQueries(plan, []),
    limitPerQuery: 8,
  }),
  rankConfig: { limit: 4 },
  fastPath: (ctx) => matchFaq(ctx.message),
  promptName: "general",
  buildSystemPrompt: buildGeneralSystem,
};
