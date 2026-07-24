import "server-only";
import { businessSearchService } from "@/services/ai/business-search.service";
import { filterByVerticalHint } from "@/lib/business-vertical-filter";
import type { Capability, CapabilityInput, CapabilityResult } from "./types";

export const businessSearchCapability: Capability = {
  id: "business_search",
  async execute(input: CapabilityInput): Promise<CapabilityResult> {
    const limit =
      typeof input.step.params.limit === "number" ? input.step.params.limit : 12;
    const verticalHint = input.step.params.verticalHint;
    // Over-fetch when filtering by vertical so the allowlist still fills the limit.
    const fetchLimit =
      typeof verticalHint === "string" && verticalHint.trim()
        ? Math.min(Math.max(limit * 2, 30), 50)
        : limit;

    const raw = await businessSearchService.search({
      city: input.city,
      query: input.step.query,
      limit: fetchLimit,
    });
    const filtered = filterByVerticalHint(raw, verticalHint);
    const businesses = filtered.slice(0, limit);

    return {
      type: "business_search",
      stepId: input.step.id,
      businesses,
      text: null,
      meta: {
        query: input.step.query,
        verticalHint:
          typeof verticalHint === "string" ? verticalHint : undefined,
        fetched: raw.length,
        afterFilter: filtered.length,
        planFacetId:
          typeof input.step.params.planFacetId === "string"
            ? input.step.params.planFacetId
            : input.step.id,
        planFacetLabel:
          typeof input.step.params.planFacetLabel === "string"
            ? input.step.params.planFacetLabel
            : undefined,
      },
    };
  },
};
