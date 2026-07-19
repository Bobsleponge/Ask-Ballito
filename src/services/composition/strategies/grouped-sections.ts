import type { BusinessResult } from "@/lib/schemas/business";
import { extractAttributes } from "@/lib/schemas/business-attributes";
import type { CompositionRequest, ExperienceSection } from "../types";

/** Experience-oriented bucket — each business lands in one section. */
function experienceBucket(b: BusinessResult): string {
  const attrs = extractAttributes(b.metadata);
  const cat = (b.category ?? "").toLowerCase();
  const hay = `${b.name} ${b.description ?? ""} ${cat}`.toLowerCase();

  if (b.priceLevel != null && b.priceLevel >= 3) return "Fine dining";
  if (attrs.seaView === true || /\bsea view|ocean view|beachfront\b/.test(hay)) {
    return "Sea views";
  }
  if (attrs.outdoorSeating === true || /\boutdoor|al fresco|patio\b/.test(hay)) {
    return "Outdoor seating";
  }
  if (attrs.romantic === true || /\bromantic|date night\b/.test(hay)) {
    return "Date night";
  }
  if (
    attrs.familyFriendly === true ||
    attrs.kidsArea === true ||
    /\bfamily|kids|children\b/.test(hay)
  ) {
    return "Family-friendly";
  }
  if (attrs.breakfast === true || /\bbreakfast|brunch\b/.test(hay)) {
    return "Breakfast & brunch";
  }
  if (/\bcafe|coffee|espresso|bakery\b/.test(hay)) return "Coffee & cafes";
  if (/\bbar|wine|cocktail|pub\b/.test(hay)) return "Drinks & bars";
  if (b.priceLevel != null && b.priceLevel <= 1) return "Easy on the wallet";

  const catLabel = b.category?.trim();
  if (catLabel) return catLabel;
  return "More options";
}

/**
 * Group into experience sections (fine dining, sea view, etc.).
 * Respects maxSections / maxItemsPerSection; caller may also enforce a global cap.
 */
export function composeGroupedSections(
  ranked: BusinessResult[],
  request: CompositionRequest,
): ExperienceSection[] {
  const buckets = new Map<string, BusinessResult[]>();

  for (const b of ranked) {
    const key = experienceBucket(b);
    const list = buckets.get(key) ?? [];
    list.push(b);
    buckets.set(key, list);
  }

  const ordered = [...buckets.entries()].sort((a, b) => {
    const scoreA = Math.max(...a[1].map((x) => x.score ?? 0));
    const scoreB = Math.max(...b[1].map((x) => x.score ?? 0));
    return scoreB - scoreA;
  });

  const sections: ExperienceSection[] = [];
  for (const [title, items] of ordered) {
    if (sections.length >= request.maxSections) break;
    const ids = items
      .slice(0, request.maxItemsPerSection)
      .map((b) => b.id);
    if (ids.length === 0) continue;
    sections.push({
      id: `group_${slug(title)}`,
      title,
      subtitle: null,
      kind: "list",
      businessIds: ids,
    });
  }

  return sections;
}

function slug(s: string): string {
  return (
    s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "other"
  );
}
