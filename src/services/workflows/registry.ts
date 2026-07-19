import type { PlannerResult } from "@/lib/ai/prompts/planner.v1";
import { restaurantsWorkflow } from "./restaurants";
import { activitiesWorkflow } from "./activities";
import { accommodationWorkflow } from "./accommodation";
import { propertyWorkflow } from "./property";
import { healthcareWorkflow } from "./healthcare";
import { emergencyWorkflow } from "./emergency";
import { relocationWorkflow } from "./relocation";
import { servicesWorkflow } from "./services";
import { generalWorkflow } from "./general";
import type { RuntimeWorkflowId, Workflow } from "./types";

const WORKFLOWS: Record<RuntimeWorkflowId, Workflow> = {
  restaurants: restaurantsWorkflow,
  activities: activitiesWorkflow,
  accommodation: accommodationWorkflow,
  property: propertyWorkflow,
  healthcare: healthcareWorkflow,
  emergency: emergencyWorkflow,
  relocation: relocationWorkflow,
  services: servicesWorkflow,
  general: generalWorkflow,
};

/**
 * Resolve the runtime workflow. Emergency constraint always wins.
 */
export function resolveWorkflow(plan: PlannerResult): Workflow {
  if (plan.constraints.emergency === true) {
    return WORKFLOWS.emergency;
  }
  return WORKFLOWS[plan.workflow] ?? WORKFLOWS.general;
}

/** True when the planner flagged an emergency (nullable boolean). */
export function isEmergencyPlan(plan: PlannerResult): boolean {
  return plan.constraints.emergency === true;
}

export function getWorkflow(id: RuntimeWorkflowId): Workflow {
  return WORKFLOWS[id] ?? WORKFLOWS.general;
}
