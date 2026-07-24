/**
 * Pure apply helpers for fit-verify decisions (no OpenAI / server-only).
 */

import type { ExperienceComposition } from "@/services/composition/types";
import type { FitVerifyResultParsed } from "@/lib/ai/prompts/fit-verify.v1";
import type { BusinessResult } from "@/lib/schemas/business";

function resolveSectionKey(
  sectionId: string,
  facetIds: Set<string>,
): string {
  const stripped = sectionId.replace(/^facet_/, "");
  if (facetIds.has(stripped)) return stripped;
  if (facetIds.has(sectionId)) return sectionId;
  return `section:${sectionId}`;
}

/**
 * Apply structured keep/drop/move decisions to a composition.
 */
export function applyFitVerifyDecisions(
  composition: ExperienceComposition,
  parsed: FitVerifyResultParsed,
  facets: Array<{ id: string; label: string }>,
): ExperienceComposition {
  const byId = new Map(composition.businesses.map((b) => [b.id, b]));
  const knownIds = new Set(byId.keys());
  const facetIds = new Set(facets.map((f) => f.id));
  const facetLabel = new Map(facets.map((f) => [f.id, f.label]));

  const originalKey = new Map<string, string>();
  for (const section of composition.sections) {
    const key = resolveSectionKey(section.id, facetIds);
    for (const id of section.businessIds) {
      originalKey.set(id, key);
      if (!key.startsWith("section:")) {
        facetLabel.set(key, section.title);
      } else {
        facetLabel.set(key, section.title);
      }
    }
  }

  type Decision = { action: "keep" | "drop" | "move"; facetId: string | null };
  const actionById = new Map<string, Decision>();

  for (const d of parsed.decisions) {
    if (!knownIds.has(d.businessId)) continue;
    if (d.action === "move") {
      const target =
        d.facetId && facetIds.has(d.facetId) ? d.facetId : null;
      actionById.set(d.businessId, {
        action: target ? "move" : "drop",
        facetId: target,
      });
    } else {
      actionById.set(d.businessId, {
        action: d.action,
        facetId: null,
      });
    }
  }

  for (const id of knownIds) {
    if (!actionById.has(id)) {
      actionById.set(id, { action: "keep", facetId: null });
    }
  }

  const membership = new Map<string, string[]>();
  const ensure = (key: string) => {
    if (!membership.has(key)) membership.set(key, []);
    return membership.get(key)!;
  };

  for (const [id, decision] of actionById) {
    if (decision.action === "drop") continue;
    if (decision.action === "move" && decision.facetId) {
      ensure(decision.facetId).push(id);
      continue;
    }
    const key = originalKey.get(id);
    if (key) ensure(key).push(id);
  }

  const seenKeys = new Set<string>();
  const sections = [];

  for (const section of composition.sections) {
    const key = resolveSectionKey(section.id, facetIds);
    seenKeys.add(key);
    const ids = [...new Set(membership.get(key) ?? [])];
    if (ids.length === 0) continue;
    sections.push({ ...section, businessIds: ids });
  }

  for (const facet of facets) {
    if (seenKeys.has(facet.id)) continue;
    const ids = [...new Set(membership.get(facet.id) ?? [])];
    if (ids.length === 0) continue;
    sections.push({
      id: `facet_${facet.id}`,
      title: facet.label,
      subtitle: null,
      kind: "list" as const,
      businessIds: ids,
    });
  }

  const used = new Set(sections.flatMap((s) => s.businessIds));
  const businesses: BusinessResult[] = composition.businesses.filter((b) =>
    used.has(b.id),
  );

  return {
    ...composition,
    sections,
    businesses,
  };
}
