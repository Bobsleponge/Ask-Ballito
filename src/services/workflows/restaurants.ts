import { buildRestaurantsSystem } from "@/lib/ai/prompts/workflows/restaurants.v1";
import { buildClarificationMessage, defaultSearchQueries } from "./base";
import type { Workflow } from "./types";

export const restaurantsWorkflow: Workflow = {
  id: "restaurants",
  requiredFields: (plan) => {
    const missing: string[] = [];
    const hasType =
      plan.entities.businessTypes.length > 0 ||
      plan.entities.cuisines.length > 0 ||
      Boolean(plan.constraints.vibe) ||
      Boolean(plan.constraints.romantic) ||
      Boolean(plan.constraints.familyFriendly) ||
      plan.searchQueries.some((q) =>
        /restaurant|cafe|coffee|dinner|lunch|brunch|food|eat/i.test(q),
      );
    if (plan.needsClarification && !hasType) {
      missing.push("What kind of place are you after — restaurant, cafe, or a specific cuisine?");
    }
    return missing;
  },
  clarificationMessage: (plan) =>
    buildClarificationMessage(plan, [
      "What kind of place are you after — restaurant, cafe, or a specific cuisine?",
    ]),
  searchStrategy: (plan) => ({
    queries: defaultSearchQueries(plan, [
      "restaurants",
      "cafes and coffee shops",
    ]),
    limitPerQuery: 12,
  }),
  rankConfig: {
    attributeBoost: 0.12,
    typeBoost: 0.12,
    limit: 6,
  },
  promptName: "restaurants",
  buildSystemPrompt: buildRestaurantsSystem,
};
