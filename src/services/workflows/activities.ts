import { buildActivitiesSystem } from "@/lib/ai/prompts/workflows/activities.v1";
import { buildClarificationMessage, defaultSearchQueries } from "./base";
import type { Workflow } from "./types";

export const activitiesWorkflow: Workflow = {
  id: "activities",
  requiredFields: (plan) => {
    if (!plan.needsClarification) return [];
    const hasHint =
      plan.entities.businessTypes.length > 0 ||
      Boolean(plan.constraints.familyFriendly) ||
      Boolean(plan.constraints.outdoor) ||
      plan.searchQueries.length > 0;
    return hasHint
      ? []
      : ["Are you looking for beaches, family fun, outdoor adventure, or something else?"];
  },
  clarificationMessage: (plan) =>
    buildClarificationMessage(plan, [
      "Are you looking for beaches, family fun, outdoor adventure, or something else?",
    ]),
  searchStrategy: (plan) => ({
    queries: defaultSearchQueries(plan, [
      "things to do and attractions",
      "beaches and outdoor activities",
    ]),
    limitPerQuery: 12,
  }),
  rankConfig: { attributeBoost: 0.1, limit: 6 },
  promptName: "activities",
  buildSystemPrompt: buildActivitiesSystem,
};
