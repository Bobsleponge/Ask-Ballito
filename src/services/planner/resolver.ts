import { normaliseGoalPrimary } from "@/config/goal-vocabulary";
import { buildCompositionRequest } from "@/services/composition/request";
import { getWorkflowDefinition } from "@/services/workflows/definitions";
import { adjustConfidence, confidenceBand, pickWorkflow } from "./confidence";
import { mergeEntities } from "./context";
import { parseDistanceLabel, resolveLocationRef } from "./location-ref";
import type {
  ConversationContext,
  ExecutionStep,
  FieldKey,
  PlannerDraft,
  PlannerPlan,
  WorkflowDefinition,
} from "./types";

function hasPlaceSignal(draft: PlannerDraft): boolean {
  return (
    draft.entities.businessTypes.length > 0 ||
    draft.entities.cuisines.length > 0 ||
    draft.draftQueries.some((q) =>
      /restaurant|cafe|coffee|dinner|lunch|brunch|food|eat|bar/i.test(q),
    )
  );
}

function missingRequiredFields(
  def: WorkflowDefinition,
  draft: PlannerDraft,
): FieldKey[] {
  const missing: FieldKey[] = [];
  for (const field of def.requiredFields) {
    switch (field) {
      case "place_type":
      case "cuisine":
        if (!hasPlaceSignal(draft)) missing.push(field);
        break;
      case "stay_type":
        if (
          !draft.entities.businessTypes.some((t) =>
            /hotel|apartment|accommodation|stay/i.test(t),
          ) &&
          !draft.draftQueries.some((q) => /hotel|stay|apartment/i.test(q))
        ) {
          missing.push(field);
        }
        break;
      case "activity_hint":
        if (
          draft.entities.businessTypes.length === 0 &&
          draft.constraints.preferred.outdoorSeating == null &&
          draft.constraints.preferred.familyFriendly == null &&
          draft.draftQueries.length === 0
        ) {
          missing.push(field);
        }
        break;
      case "care_type":
        if (
          !draft.entities.businessTypes.some((t) =>
            /doctor|dentist|clinic|pharmacy|gp/i.test(t),
          ) &&
          draft.draftQueries.length === 0
        ) {
          missing.push(field);
        }
        break;
      case "service_type":
        if (
          draft.entities.businessTypes.length === 0 &&
          draft.draftQueries.length === 0
        ) {
          missing.push(field);
        }
        break;
      case "property_intent":
        if (
          draft.entities.estates.length === 0 &&
          !draft.entities.businessTypes.some((t) =>
            /estate|agent|property|rent|buy/i.test(t),
          ) &&
          draft.draftQueries.length === 0
        ) {
          missing.push(field);
        }
        break;
      default:
        break;
    }
  }
  return missing;
}

function buildExecutionPlan(
  def: WorkflowDefinition,
  draft: PlannerDraft,
): ExecutionStep[] {
  if (def.id === "emergency") return def.defaultExecutionPlan.map((s) => ({ ...s }));

  if (draft.draftQueries.length > 0 && def.id !== "relocation") {
    return draft.draftQueries.map((query, i) => ({
      id: `draft_${i}`,
      capability: "business_search" as const,
      type: "business_search" as const,
      query,
      params: { limit: 12 },
      priority: i + 1,
      optional: false,
    }));
  }

  if (def.id === "relocation") {
    const base = def.defaultExecutionPlan.map((s) => ({ ...s }));
    draft.draftQueries.forEach((query, i) => {
      base.push({
        id: `draft_${i}`,
        capability: "business_search",
        type: "business_search",
        query,
        params: { limit: 8 },
        priority: 100 + i,
        optional: true,
      });
    });
    return base;
  }

  return def.defaultExecutionPlan.map((s) => ({ ...s }));
}

/**
 * Deterministic resolver: turns PlannerDraft + ConversationContext into PlannerPlan.
 */
export function resolvePlannerPlan(
  draft: PlannerDraft,
  context: ConversationContext,
): PlannerPlan {
  const rulesApplied: string[] = [];
  const { confidence, rules: confRules } = adjustConfidence(draft);
  rulesApplied.push(...confRules);

  const goal = {
    primary: normaliseGoalPrimary(draft.goal.primary),
    description: draft.goal.description,
  };

  const { workflow, rejected, rules: wfRules } = pickWorkflow(
    draft.candidateWorkflows,
    draft.constraints.emergency,
  );
  rulesApplied.push(...wfRules);

  const def = getWorkflowDefinition(workflow);
  const { merged: entities, stickyUsed } = mergeEntities(
    context.stickyEntities,
    draft.entities,
  );
  if (stickyUsed) rulesApplied.push("sticky_entities_merged");

  const constraints = {
    ...draft.constraints,
    preferred: { ...draft.constraints.preferred },
    required: { ...draft.constraints.required },
    avoid: { ...draft.constraints.avoid },
  };

  if (constraints.distanceLabel && constraints.distanceMeters == null) {
    constraints.distanceMeters = parseDistanceLabel(constraints.distanceLabel);
  }

  if (
    entities.people.some((p) => /family|kid|child/i.test(p)) &&
    constraints.preferred.familyFriendly == null
  ) {
    constraints.preferred.familyFriendly = true;
    rulesApplied.push("infer_family_from_people");
  }

  const locationRef = resolveLocationRef(entities, context.stickyEntities);
  if (locationRef) rulesApplied.push(`location_ref_${locationRef.source}`);

  const draftForFields = { ...draft, entities };
  const missing = missingRequiredFields(def, draftForFields);
  const band = confidenceBand(confidence);
  const executionPlan = buildExecutionPlan(def, draftForFields);

  let clarify = false;
  if (workflow === "emergency") {
    clarify = false;
  } else if (
    band === "low" &&
    !hasPlaceSignal(draftForFields) &&
    workflow !== "relocation" &&
    workflow !== "general"
  ) {
    clarify = true;
    rulesApplied.push("clarify_low_confidence");
  } else if (
    missing.length > 0 &&
    !def.responseBehaviour.allowExecuteWithoutRequired &&
    draft.draftQueries.length === 0 &&
    !hasPlaceSignal(draftForFields)
  ) {
    clarify = true;
    rulesApplied.push("clarify_missing_required");
  } else if (
    workflow === "general" &&
    band === "low" &&
    /somewhere nice|anything nice/i.test(goal.description)
  ) {
    clarify = true;
    rulesApplied.push("clarify_vague_general");
  }

  const clarificationQuestion = clarify
    ? (def.clarify[missing[0] ?? def.requiredFields[0] ?? "place_type"] ??
      "What are you looking for in Ballito?")
    : null;

  let responseMode: PlannerPlan["responseMode"] = "execute_and_explain";
  let llmRequired = true;

  if (clarify) {
    responseMode = "clarify";
    llmRequired = false;
  } else if (workflow === "emergency") {
    responseMode = "fast_path";
    llmRequired = false;
  } else if (workflow === "general" && draft.draftQueries.length === 0) {
    responseMode = "general_reply";
    llmRequired = true;
  } else {
    responseMode = "execute_and_explain";
    llmRequired = true;
  }

  const { request: composition, rules: compositionRules } =
    buildCompositionRequest({
      goalPrimary: goal.primary,
      goalDescription: goal.description,
      intent: draft.intent,
      workflowId: workflow,
      defaultStrategy: def.defaultCompositionStrategy ?? "ranked_list",
      entities,
      constraints,
      locationRef,
    });
  rulesApplied.push(...compositionRules);

  return {
    version: "v2",
    intent: draft.intent,
    goal,
    workflow,
    confidence,
    entities,
    constraints,
    missingInformation: missing,
    needsClarification: clarify,
    clarificationQuestion,
    executionPlan: clarify ? [] : executionPlan,
    llmRequired,
    responseMode,
    locationRef,
    composition,
    diagnostics: {
      extractorConfidence: draft.confidence,
      rejectedWorkflows: rejected,
      rulesApplied,
      stickyEntitiesUsed: stickyUsed,
    },
  };
}
