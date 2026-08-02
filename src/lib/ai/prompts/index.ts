export * from "./types";
export * from "./planner.v2";
export * from "./query-intelligence.v1";
export * from "./recommendation.v1";
export * from "./conversation.v1";
export * from "./workflows/restaurants.v1";
export * from "./workflows/activities.v1";
export * from "./workflows/accommodation.v1";
export * from "./workflows/property.v1";
export * from "./workflows/healthcare.v1";
export * from "./workflows/emergency.v1";
export * from "./workflows/general.v1";
export * from "./workflows/relocation.v1";
export * from "./workflows/services.v1";
export * from "./workflows/special-occasion.v1";
export * from "./fit-verify.v1";
export * from "./enrichment.v1";

import { PLANNER_V2_PROMPT } from "./planner.v2";
import { QUERY_INTELLIGENCE_V1_PROMPT } from "./query-intelligence.v1";
import { RECOMMENDATION_PROMPT } from "./recommendation.v1";
import { CONVERSATION_PROMPT } from "./conversation.v1";
import { RESTAURANTS_PROMPT } from "./workflows/restaurants.v1";
import { ACTIVITIES_PROMPT } from "./workflows/activities.v1";
import { ACCOMMODATION_PROMPT } from "./workflows/accommodation.v1";
import { PROPERTY_PROMPT } from "./workflows/property.v1";
import { HEALTHCARE_PROMPT } from "./workflows/healthcare.v1";
import { EMERGENCY_PROMPT } from "./workflows/emergency.v1";
import { GENERAL_PROMPT } from "./workflows/general.v1";
import { RELOCATION_PROMPT } from "./workflows/relocation.v1";
import { SERVICES_PROMPT } from "./workflows/services.v1";
import { SPECIAL_OCCASION_PROMPT } from "./workflows/special-occasion.v1";
import { FIT_VERIFY_PROMPT } from "./fit-verify.v1";
import { ENRICHMENT_PROMPT } from "./enrichment.v1";

/** Registry of active prompt versions, for logging and auditing. */
export const ACTIVE_PROMPTS = {
  planner_v2: PLANNER_V2_PROMPT,
  query_intelligence_v1: QUERY_INTELLIGENCE_V1_PROMPT,
  recommendation: RECOMMENDATION_PROMPT,
  conversation: CONVERSATION_PROMPT,
  restaurants: RESTAURANTS_PROMPT,
  activities: ACTIVITIES_PROMPT,
  accommodation: ACCOMMODATION_PROMPT,
  property: PROPERTY_PROMPT,
  healthcare: HEALTHCARE_PROMPT,
  emergency: EMERGENCY_PROMPT,
  general: GENERAL_PROMPT,
  relocation: RELOCATION_PROMPT,
  services: SERVICES_PROMPT,
  special_occasion: SPECIAL_OCCASION_PROMPT,
  fit_verify: FIT_VERIFY_PROMPT,
  enrichment: ENRICHMENT_PROMPT,
} as const;

export type PromptName = keyof typeof ACTIVE_PROMPTS;

export function promptVersion(name: PromptName): string {
  return `${ACTIVE_PROMPTS[name].name}@${ACTIVE_PROMPTS[name].version}`;
}
