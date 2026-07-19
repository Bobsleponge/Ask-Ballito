import { matchFaq } from "@/config/local-knowledge";
import type { Capability, CapabilityInput, CapabilityResult } from "./types";

export const faqCapability: Capability = {
  id: "faq",
  async execute(input: CapabilityInput): Promise<CapabilityResult> {
    const q = input.message || input.step.query;
    const text = q ? matchFaq(q) : null;
    return {
      type: "faq",
      stepId: input.step.id,
      businesses: [],
      text,
    };
  },
};
