import type { City } from "@/config/cities";
import type {
  CapabilityId,
  ExecutionStep,
  PlannerPlan,
} from "@/services/planner/types";
import type { BusinessResult } from "@/lib/schemas/business";

export interface CapabilityInput {
  step: ExecutionStep;
  city: City;
  plan: PlannerPlan;
  /** Original user message for FAQ matching. */
  message?: string;
}

export interface CapabilityResult {
  type: CapabilityId;
  stepId: string;
  businesses: BusinessResult[];
  text: string | null;
  meta?: Record<string, unknown>;
}

export interface Capability {
  id: CapabilityId;
  execute(input: CapabilityInput): Promise<CapabilityResult>;
}
