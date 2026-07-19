import type { BusinessResult } from "@/lib/schemas/business";
import type { CompositionRequest, ExperienceSection } from "../types";

export function composeRankedList(
  ranked: BusinessResult[],
  request: CompositionRequest,
): ExperienceSection[] {
  const ids = ranked
    .slice(0, request.maxItemsPerSection)
    .map((b) => b.id);
  if (ids.length === 0) return [];
  return [
    {
      id: "top_matches",
      title: request.titleHint ?? "Top matches",
      subtitle: null,
      kind: "list",
      businessIds: ids,
    },
  ];
}
