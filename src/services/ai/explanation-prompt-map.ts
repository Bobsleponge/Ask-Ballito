import type { PromptName } from "@/lib/ai/prompts";
import {
  SECTION_EXPLAINER_ADDENDUM,
  SERVICES_SECTION_ADDENDUM,
} from "@/lib/ai/prompts/recommendation.v1";
import { buildRestaurantsSystem } from "@/lib/ai/prompts/workflows/restaurants.v1";
import { buildActivitiesSystem } from "@/lib/ai/prompts/workflows/activities.v1";
import { buildAccommodationSystem } from "@/lib/ai/prompts/workflows/accommodation.v1";
import { buildPropertySystem } from "@/lib/ai/prompts/workflows/property.v1";
import { buildHealthcareSystem } from "@/lib/ai/prompts/workflows/healthcare.v1";
import { buildEmergencySystem } from "@/lib/ai/prompts/workflows/emergency.v1";
import { buildGeneralSystem } from "@/lib/ai/prompts/workflows/general.v1";
import { buildRelocationSystem } from "@/lib/ai/prompts/workflows/relocation.v1";
import { buildServicesSystem } from "@/lib/ai/prompts/workflows/services.v1";
import { buildSpecialOccasionSystem } from "@/lib/ai/prompts/workflows/special-occasion.v1";
import type { WorkflowId } from "@/services/planner/types";
import { getWorkflowDefinition } from "@/services/workflows/definitions";

const PROMPT_NAME_BY_WORKFLOW: Record<WorkflowId, PromptName> = {
  restaurants: "restaurants",
  activities: "activities",
  accommodation: "accommodation",
  property: "property",
  healthcare: "healthcare",
  emergency: "emergency",
  relocation: "relocation",
  special_occasion: "special_occasion",
  services: "services",
  general: "general",
};

const SYSTEM_BY_WORKFLOW: Record<
  WorkflowId,
  (cityName: string) => string
> = {
  restaurants: buildRestaurantsSystem,
  activities: buildActivitiesSystem,
  accommodation: buildAccommodationSystem,
  property: buildPropertySystem,
  healthcare: buildHealthcareSystem,
  emergency: buildEmergencySystem,
  relocation: buildRelocationSystem,
  special_occasion: buildSpecialOccasionSystem,
  services: buildServicesSystem,
  general: buildGeneralSystem,
};

function withSectionAddendum(base: string): string {
  return `${base}\n${SECTION_EXPLAINER_ADDENDUM}`;
}

function withServicesAddendum(base: string): string {
  return `${base}\n${SERVICES_SECTION_ADDENDUM}`;
}

/** Orchestrator-owned mapping — planner must not reference prompts. */
export function explanationForWorkflow(workflow: WorkflowId): {
  promptName: PromptName;
  buildSystemPrompt: (cityName: string) => string;
  emptyResultsMessage: string;
} {
  const def = getWorkflowDefinition(workflow);
  const base = SYSTEM_BY_WORKFLOW[workflow] ?? buildGeneralSystem;
  return {
    promptName: PROMPT_NAME_BY_WORKFLOW[workflow] ?? "general",
    buildSystemPrompt: (cityName: string) => {
      const system = base(cityName);
      if (workflow === "services") return withServicesAddendum(system);
      if (workflow === "emergency") return system;
      return withSectionAddendum(system);
    },
    emptyResultsMessage: def.responseBehaviour.emptyResultsMessage,
  };
}
