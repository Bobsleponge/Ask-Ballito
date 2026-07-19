import type { BusinessResult } from "@/lib/schemas/business";
import { extractAttributes } from "@/lib/schemas/business-attributes";
import type { CompositionRequest, ExperienceSection } from "../types";

function priceOf(b: BusinessResult): number {
  return b.priceLevel ?? 2;
}

export function composeComparison(
  ranked: BusinessResult[],
  request: CompositionRequest,
): ExperienceSection[] {
  if (ranked.length === 0) return [];

  const outdoorSplit = tryOutdoorSplit(ranked, request);
  if (outdoorSplit) return outdoorSplit;

  const sorted = [...ranked].sort((a, b) => priceOf(a) - priceOf(b));
  const mid = Math.ceil(sorted.length / 2);
  const lower = sorted.slice(0, mid);
  const higher = sorted.slice(mid).reverse();

  const hintA = request.sectionHints[0];
  const hintB = request.sectionHints[1];
  const max = request.maxItemsPerSection;

  const sections: ExperienceSection[] = [];
  if (lower.length > 0) {
    sections.push({
      id: hintA?.id ?? "option_a",
      title: hintA?.title ?? "More affordable",
      subtitle: "Lower price level",
      kind: "compare_column",
      businessIds: lower.slice(0, max).map((b) => b.id),
    });
  }
  if (higher.length > 0) {
    sections.push({
      id: hintB?.id ?? "option_b",
      title: hintB?.title ?? "More upscale",
      subtitle: "Higher price level",
      kind: "compare_column",
      businessIds: higher.slice(0, max).map((b) => b.id),
    });
  }
  return sections.slice(0, request.maxSections);
}

function tryOutdoorSplit(
  ranked: BusinessResult[],
  request: CompositionRequest,
): ExperienceSection[] | null {
  const outdoor: BusinessResult[] = [];
  const indoor: BusinessResult[] = [];
  for (const b of ranked) {
    const attrs = extractAttributes(b.metadata);
    if (attrs.outdoorSeating === true) outdoor.push(b);
    else if (attrs.outdoorSeating === false) indoor.push(b);
  }
  if (outdoor.length < 1 || indoor.length < 1) return null;

  const max = request.maxItemsPerSection;
  const sections: ExperienceSection[] = [
    {
      id: "outdoor",
      title: "Outdoor seating",
      subtitle: null,
      kind: "compare_column",
      businessIds: outdoor.slice(0, max).map((b) => b.id),
    },
    {
      id: "indoor",
      title: "Indoor focus",
      subtitle: null,
      kind: "compare_column",
      businessIds: indoor.slice(0, max).map((b) => b.id),
    },
  ];
  return sections.slice(0, request.maxSections);
}
