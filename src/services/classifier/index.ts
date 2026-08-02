import {
  emptyConstraintModel,
  emptyEntityModel,
  type ConversationContext,
  type PlannerDraft,
  type WorkflowId,
} from "@/services/planner/types";
import { resolvePlannerPlan } from "@/services/planner/resolver";
import type { ClassificationResult } from "./types";

/**
 * Build a PlannerDraft from a high-confidence classification so we can
 * skip the LLM extractor and still run the deterministic resolver.
 *
 * @deprecated For arbitrary natural-language search asks, prefer Query Intelligence
 * (`QUERY_INTELLIGENCE=1`). Keep this path for emergency / FAQ / exact discover cards only.
 */
export function draftFromClassification(
  classification: ClassificationResult,
  message: string,
): PlannerDraft {
  const entities = emptyEntityModel();
  entities.businessTypes = [...classification.businessTypes];
  entities.cuisines = [...classification.cuisines];

  const constraints = emptyConstraintModel();
  if (/\bopen\s*now\b/i.test(message)) {
    constraints.openNow = true;
  }
  if (/\bfamily|kids?|children\b/i.test(message)) {
    constraints.preferred.familyFriendly = true;
  }
  if (/\bromantic|date night\b/i.test(message)) {
    constraints.preferred.romantic = true;
  }
  if (/\bdog|pet[- ]?friendly\b/i.test(message)) {
    constraints.preferred.petFriendly = true;
  }
  if (/\brainy|indoor\b/i.test(message)) {
    constraints.preferred.rainFriendly = true;
  }
  if (/\bbreakfast\b/i.test(message)) {
    constraints.preferred.breakfast = true;
  }

  const workflow = classification.suggestedWorkflow;
  const goalPrimary = goalPrimaryFor(workflow, classification.queryClass);

  return {
    intent: classification.queryClass.toLowerCase(),
    goal: {
      primary: goalPrimary,
      description: message.slice(0, 200),
    },
    confidence: classification.confidence,
    candidateWorkflows: [workflow],
    entities,
    constraints,
    draftQueries:
      classification.draftQueries.length > 0
        ? classification.draftQueries
        : [message.slice(0, 120)],
    planFacets: [],
    notes: `classifier:${classification.signals.join(",")}`,
  };
}

function goalPrimaryFor(
  workflow: WorkflowId,
  queryClass: ClassificationResult["queryClass"],
): string {
  if (workflow === "emergency") return "emergency_help";
  if (queryClass === "DISCOVERY") return "discover_local";
  if (queryClass === "FACT") return "local_fact";
  if (queryClass === "LIVE_INFORMATION") return "live_info";
  if (queryClass === "EVENT_SEARCH") return "find_events";
  if (queryClass === "PLACE_SEARCH") return "find_place";
  switch (workflow) {
    case "restaurants":
      return "find_restaurant";
    case "activities":
      return "find_activity";
    case "accommodation":
      return "find_stay";
    case "property":
      return "find_property";
    case "healthcare":
      return "find_care";
    case "services":
      return "find_service";
    case "special_occasion":
      return "plan_occasion";
    default:
      return "find_business";
  }
}

/**
 * Resolve a full PlannerPlan from classification without calling the extractor.
 */
export function resolveFromClassification(
  classification: ClassificationResult,
  context: ConversationContext,
  message: string,
) {
  const draft = draftFromClassification(classification, message);
  return resolvePlannerPlan(draft, context, message);
}

export { classifyQuery } from "./classify";
export type { ClassificationResult } from "./types";
