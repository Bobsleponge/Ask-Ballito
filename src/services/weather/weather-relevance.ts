import type { WorkflowId } from "@/services/planner/types";

/**
 * Workflows where outdoor conditions actually change what we should recommend
 * or say. Hairdressers, plumbers, doctors, etc. are excluded.
 */
const WEATHER_RELEVANT_WORKFLOWS = new Set<WorkflowId>([
  "restaurants",
  "activities",
  "accommodation",
  "special_occasion",
]);

export function isWeatherRelevantWorkflow(workflow: WorkflowId): boolean {
  return WEATHER_RELEVANT_WORKFLOWS.has(workflow);
}
