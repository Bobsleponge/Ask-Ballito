import type { BusinessResult } from "@/lib/schemas/business";
import type { CompositionRequest, ExperienceSection, SectionHint } from "../types";

function matchesHint(b: BusinessResult, hint: SectionHint): boolean {
  const hay = [
    b.category ?? "",
    b.name,
    b.description ?? "",
  ]
    .join(" ")
    .toLowerCase();

  const cats = hint.match?.categories ?? [];
  const cuisines = hint.match?.cuisines ?? [];
  const needles = [...cats, ...cuisines].map((s) => s.toLowerCase());
  if (needles.length === 0) return true;
  return needles.some((n) => hay.includes(n));
}

export function composeItinerary(
  ranked: BusinessResult[],
  request: CompositionRequest,
): ExperienceSection[] {
  const hints =
    request.sectionHints.length > 0
      ? request.sectionHints
      : [
          { id: "step_1", title: "Start here", kind: "itinerary_step" as const },
          { id: "step_2", title: "Next", kind: "itinerary_step" as const },
          { id: "step_3", title: "Wind down", kind: "itinerary_step" as const },
        ];

  const used = new Set<string>();
  const sections: ExperienceSection[] = [];

  for (const hint of hints) {
    if (sections.length >= request.maxSections) break;
    const picks: string[] = [];
    for (const b of ranked) {
      if (used.has(b.id)) continue;
      if (!matchesHint(b, hint)) continue;
      picks.push(b.id);
      used.add(b.id);
      if (picks.length >= request.maxItemsPerSection) break;
    }

    // Soft fill: if no keyword match, take next unused by rank.
    if (picks.length === 0) {
      for (const b of ranked) {
        if (used.has(b.id)) continue;
        picks.push(b.id);
        used.add(b.id);
        if (picks.length >= request.maxItemsPerSection) break;
      }
    }

    if (picks.length === 0) continue;
    sections.push({
      id: hint.id,
      title: hint.title,
      subtitle: null,
      kind: "itinerary_step",
      businessIds: picks,
    });
  }

  return sections;
}
