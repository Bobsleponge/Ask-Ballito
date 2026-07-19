import {
  BALLITO_EMERGENCY,
  formatEmergencyContacts,
} from "@/config/local-knowledge";
import type { Capability, CapabilityInput, CapabilityResult } from "./types";

export const staticDatasetCapability: Capability = {
  id: "static_dataset",
  async execute(input: CapabilityInput): Promise<CapabilityResult> {
    const dataset = String(input.step.params.dataset ?? input.step.query);
    if (dataset === "emergency_contacts" || input.step.query === "emergency") {
      return {
        type: "static_dataset",
        stepId: input.step.id,
        businesses: [],
        text: formatEmergencyContacts(BALLITO_EMERGENCY),
      };
    }
    return {
      type: "static_dataset",
      stepId: input.step.id,
      businesses: [],
      text: null,
      meta: { unknownDataset: dataset },
    };
  },
};
