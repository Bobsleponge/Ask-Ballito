import "server-only";
import { businessSearchService } from "@/services/ai/business-search.service";
import type { Capability, CapabilityInput, CapabilityResult } from "./types";

export const businessSearchCapability: Capability = {
  id: "business_search",
  async execute(input: CapabilityInput): Promise<CapabilityResult> {
    const limit =
      typeof input.step.params.limit === "number" ? input.step.params.limit : 12;
    const businesses = await businessSearchService.search({
      city: input.city,
      query: input.step.query,
      limit,
    });
    return {
      type: "business_search",
      stepId: input.step.id,
      businesses,
      text: null,
      meta: { query: input.step.query },
    };
  },
};
