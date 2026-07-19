import type { PlannerDraft, WorkflowId } from "./types";

export type ConfidenceBand = "high" | "medium" | "low";

export function confidenceBand(confidence: number): ConfidenceBand {
  if (confidence >= 0.8) return "high";
  if (confidence >= 0.5) return "medium";
  return "low";
}

export function adjustConfidence(draft: PlannerDraft): {
  confidence: number;
  rules: string[];
} {
  let confidence = Math.min(1, Math.max(0, draft.confidence));
  const rules: string[] = [];

  if (draft.constraints.emergency === true) {
    return { confidence: Math.max(confidence, 0.95), rules: ["emergency_high_confidence"] };
  }

  if (draft.candidateWorkflows.length >= 3) {
    confidence -= 0.15;
    rules.push("many_candidate_workflows");
  }

  const vague =
    draft.entities.businessTypes.length === 0 &&
    draft.entities.cuisines.length === 0 &&
    /somewhere nice|anything|something nice|not sure/i.test(
      draft.goal.description,
    );
  if (vague) {
    confidence = Math.min(confidence, 0.4);
    rules.push("vague_goal_force_low");
  }

  return { confidence: Math.min(1, Math.max(0, confidence)), rules };
}

export function pickWorkflow(
  candidates: WorkflowId[],
  emergency: boolean | null,
): { workflow: WorkflowId; rejected: WorkflowId[]; rules: string[] } {
  const rules: string[] = [];
  if (emergency === true) {
    return {
      workflow: "emergency",
      rejected: candidates.filter((c) => c !== "emergency"),
      rules: ["emergency_override"],
    };
  }

  const list = candidates.length > 0 ? candidates : (["general"] as WorkflowId[]);
  const workflow = list[0];
  const rejected = list.slice(1);

  if (list.length > 1 && list.every((w) => w === list[0])) {
    rules.push("tied_candidates");
  }

  return { workflow, rejected, rules };
}
