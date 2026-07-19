import type { BusinessResult } from "@/lib/schemas/business";
import type { LocationRef } from "@/services/planner/types";
import { haversineMeters } from "@/services/planner/location-ref";
import type { CompositionRequest, ExperienceSection } from "../types";
import { composeRankedList } from "./ranked-list";

export function composeNearestFirst(
  ranked: BusinessResult[],
  request: CompositionRequest,
  locationRef: LocationRef | null,
): { sections: ExperienceSection[]; fellBack: boolean } {
  if (
    !locationRef ||
    locationRef.lat == null ||
    locationRef.lng == null
  ) {
    return {
      sections: composeRankedList(ranked, {
        ...request,
        titleHint: request.titleHint ?? "Top matches",
      }),
      fellBack: true,
    };
  }

  const originLat = locationRef.lat;
  const originLng = locationRef.lng;

  const withDistance = ranked
    .filter((b) => b.lat != null && b.lng != null)
    .map((b) => ({
      business: b,
      meters: haversineMeters(originLat, originLng, b.lat!, b.lng!),
    }))
    .sort((a, b) => a.meters - b.meters);

  const pool =
    withDistance.length > 0
      ? withDistance.map((x) => x.business)
      : ranked;

  const ids = pool.slice(0, request.maxItemsPerSection).map((b) => b.id);
  if (ids.length === 0) return { sections: [], fellBack: false };

  return {
    sections: [
      {
        id: "nearest",
        title: request.titleHint ?? `Nearest to ${locationRef.label}`,
        subtitle: "Ordered by distance",
        kind: "nearest",
        businessIds: ids,
      },
    ],
    fellBack: false,
  };
}
