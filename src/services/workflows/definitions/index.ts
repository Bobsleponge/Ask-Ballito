import type { WorkflowDefinition, WorkflowId } from "@/services/planner/types";
import { restaurantsDefinition } from "./restaurants";
import { activitiesDefinition } from "./activities";
import { accommodationDefinition } from "./accommodation";
import { propertyDefinition } from "./property";
import { healthcareDefinition } from "./healthcare";
import { emergencyDefinition } from "./emergency";
import { relocationDefinition } from "./relocation";
import { servicesDefinition } from "./services";
import { generalDefinition } from "./general";

export const WORKFLOW_DEFINITIONS: Record<WorkflowId, WorkflowDefinition> = {
  restaurants: restaurantsDefinition,
  activities: activitiesDefinition,
  accommodation: accommodationDefinition,
  property: propertyDefinition,
  healthcare: healthcareDefinition,
  emergency: emergencyDefinition,
  relocation: relocationDefinition,
  services: servicesDefinition,
  general: generalDefinition,
};

export function getWorkflowDefinition(id: WorkflowId): WorkflowDefinition {
  return WORKFLOW_DEFINITIONS[id] ?? generalDefinition;
}
