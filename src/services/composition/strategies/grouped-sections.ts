import type { BusinessResult } from "@/lib/schemas/business";
import type { CompositionRequest, ExperienceSection } from "../types";
import {
  activityBucket,
  activitySectionSortKey,
} from "./activity-buckets";
import { diningBucket } from "./dining-buckets";
import { composePlanFacetSections } from "./plan-facets";

/**
 * Group into experience sections.
 * Activities profile: beaches share a section; malls split by entertainment vs food.
 */
export function composeGroupedSections(
  ranked: BusinessResult[],
  request: CompositionRequest,
): ExperienceSection[] {
  const profile = request.bucketProfile ?? "default";

  if (profile === "plan_facets") {
    return composePlanFacetSections(ranked, request);
  }

  const buckets = new Map<string, BusinessResult[]>();

  for (const b of ranked) {
    const key =
      profile === "activities" ? activityBucket(b) : diningBucket(b);
    if (!key) continue;
    const list = buckets.get(key) ?? [];
    list.push(b);
    buckets.set(key, list);
  }

  const ordered = [...buckets.entries()].sort((a, b) => {
    if (profile === "activities") {
      const order =
        activitySectionSortKey(
          a[0],
          request.preferIndoorDueToWeather,
          request.preferOutdoorDueToWeather,
        ) -
        activitySectionSortKey(
          b[0],
          request.preferIndoorDueToWeather,
          request.preferOutdoorDueToWeather,
        );
      if (order !== 0) return order;
    } else if (request.preferIndoorDueToWeather) {
      const indoorBoost = (title: string) => {
        if (/outdoor seating/i.test(title)) return 40;
        if (/sea views/i.test(title)) return 35;
        if (/coffee|cafe|family|fine dining|drinks|breakfast/i.test(title)) {
          return -10;
        }
        return 0;
      };
      const order = indoorBoost(a[0]) - indoorBoost(b[0]);
      if (order !== 0) return order;
    } else if (request.preferOutdoorDueToWeather) {
      const outdoorBoost = (title: string) => {
        if (/sea views/i.test(title)) return -40;
        if (/outdoor seating/i.test(title)) return -35;
        if (/drinks|bars|coffee|cafe|fine dining/i.test(title)) return 5;
        return 0;
      };
      const order = outdoorBoost(a[0]) - outdoorBoost(b[0]);
      if (order !== 0) return order;
    }
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
