import { buildHealthcareSystem } from "@/lib/ai/prompts/workflows/healthcare.v1";
import { buildClarificationMessage, defaultSearchQueries } from "./base";
import type { Workflow } from "./types";

export const healthcareWorkflow: Workflow = {
  id: "healthcare",
  requiredFields: (plan) => {
    if (!plan.needsClarification) return [];
    return plan.entities.businessTypes.length > 0 || plan.searchQueries.length > 0
      ? []
      : ["Do you need a GP, dentist, pharmacy, or specialist?"];
  },
  clarificationMessage: (plan) =>
    buildClarificationMessage(plan, [
      "Do you need a GP, dentist, pharmacy, or specialist?",
    ]),
  searchStrategy: (plan) => ({
    queries: defaultSearchQueries(plan, [
      "doctors and medical clinics",
      "pharmacies",
    ]),
    limitPerQuery: 12,
  }),
  rankConfig: { limit: 6 },
  promptName: "healthcare",
  buildSystemPrompt: buildHealthcareSystem,
};
