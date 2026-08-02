import "server-only";
import { businessSearchService } from "@/services/ai/business-search.service";
import { filterByVerticalHint } from "@/lib/business-vertical-filter";
import type { Capability, CapabilityInput, CapabilityResult } from "./types";

function geoFromPlan(input: CapabilityInput): {
  lat?: number;
  lng?: number;
  radiusMeters?: number;
} {
  const ref = input.plan.locationRef;
  if (ref?.lat == null || ref?.lng == null) return {};
  return {
    lat: ref.lat,
    lng: ref.lng,
    radiusMeters:
      input.plan.constraints.distanceMeters ??
      input.city.defaultRadiusMeters,
  };
}

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

    const geo = geoFromPlan(input);
    const raw = await businessSearchService.search({
      city: input.city,
      query: input.step.query,
      limit: fetchLimit,
      ...geo,
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
        geoApplied: geo.lat != null,
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
