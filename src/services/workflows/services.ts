import { buildServicesSystem } from "@/lib/ai/prompts/workflows/services.v1";
import { buildClarificationMessage, defaultSearchQueries } from "./base";
import type { Workflow } from "./types";

export const servicesWorkflow: Workflow = {
  id: "services",
  requiredFields: (plan) => {
    if (!plan.needsClarification) return [];
    return plan.entities.businessTypes.length > 0 || plan.searchQueries.length > 0
      ? []
      : ["What kind of service do you need — beauty, fitness, repairs, or something else?"];
  },
  clarificationMessage: (plan) =>
    buildClarificationMessage(plan, [
      "What kind of service do you need — beauty, fitness, repairs, or something else?",
    ]),
  searchStrategy: (plan) => ({
    queries: defaultSearchQueries(plan, [
      "professional services",
      "beauty and spa",
      "gyms and fitness",
    ]),
    limitPerQuery: 12,
  }),
  rankConfig: { limit: 6 },
  promptName: "services",
  buildSystemPrompt: buildServicesSystem,
};
