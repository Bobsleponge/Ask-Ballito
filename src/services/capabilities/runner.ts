import "server-only";
import type { City } from "@/config/cities";
import type { ExecutionStep, PlannerPlan } from "@/services/planner/types";
import type { BusinessResult } from "@/lib/schemas/business";
import { getCapability } from "./registry";
import type { CapabilityResult } from "./types";

export interface ExecutionRunResult {
  results: CapabilityResult[];
  businesses: BusinessResult[];
  fastPathText: string | null;
  unknownCapabilities: string[];
}

/**
 * Runs an ordered execution plan via the capability registry.
 * business_search steps run in parallel batches by priority.
 */
export async function runExecutionPlan(opts: {
  plan: PlannerPlan;
  city: City;
  message: string;
}): Promise<ExecutionRunResult> {
  const steps = [...opts.plan.executionPlan].sort(
    (a, b) => a.priority - b.priority,
  );
  const results: CapabilityResult[] = [];
  const unknownCapabilities: string[] = [];
  let fastPathText: string | null = null;

  const byPriority = new Map<number, ExecutionStep[]>();
  for (const step of steps) {
    const list = byPriority.get(step.priority) ?? [];
    list.push(step);
    byPriority.set(step.priority, list);
  }

  const priorities = [...byPriority.keys()].sort((a, b) => a - b);

  for (const p of priorities) {
    const batch = byPriority.get(p)!;
    const batchResults = await Promise.all(
      batch.map(async (step) => {
        const cap = getCapability(step.capability);
        if (!cap) {
          unknownCapabilities.push(step.capability);
          return null;
        }
        return cap.execute({
          step,
          city: opts.city,
          plan: opts.plan,
          message: opts.message,
        });
      }),
    );

    for (const r of batchResults) {
      if (!r) continue;
      results.push(r);
      if (r.text && !fastPathText) fastPathText = r.text;
    }
  }

  const byId = new Map<string, BusinessResult>();
  for (const r of results) {
    for (const b of r.businesses) {
      const facetId =
        typeof r.meta?.planFacetId === "string"
          ? r.meta.planFacetId
          : typeof r.stepId === "string"
            ? r.stepId
            : null;
      const facetLabel =
        typeof r.meta?.planFacetLabel === "string"
          ? r.meta.planFacetLabel
          : undefined;
      const tagged =
        facetId != null
          ? {
              ...b,
              metadata: {
                ...(b.metadata ?? {}),
                planFacetId:
                  (b.metadata?.planFacetId as string | undefined) ?? facetId,
                ...(facetLabel && !b.metadata?.planFacetLabel
                  ? { planFacetLabel: facetLabel }
                  : {}),
              },
            }
          : b;
      const existing = byId.get(tagged.id);
      if (!existing) {
        byId.set(tagged.id, tagged);
        continue;
      }

      const existingFacet =
        typeof existing.metadata?.planFacetId === "string"
          ? existing.metadata.planFacetId
          : null;
      const taggedFacet =
        typeof tagged.metadata?.planFacetId === "string"
          ? tagged.metadata.planFacetId
          : null;

      // Prefer dining facet for restaurant-like hits even if another facet
      // scored a slightly higher similarity (stops venues/cake "stealing" dinners).
      const restaurantLike = isRestaurantBusiness(tagged);
      const taggedIsDining = isDiningFacetId(taggedFacet, facetLabel);
      const existingIsDining = isDiningFacetId(existingFacet, null);
      if (restaurantLike && taggedIsDining && !existingIsDining) {
        byId.set(tagged.id, {
          ...tagged,
          similarity: Math.max(
            tagged.similarity ?? 0,
            existing.similarity ?? 0,
          ),
        });
        continue;
      }
      if (restaurantLike && existingIsDining && !taggedIsDining) {
        byId.set(tagged.id, {
          ...existing,
          similarity: Math.max(
            tagged.similarity ?? 0,
            existing.similarity ?? 0,
          ),
        });
        continue;
      }

      if ((tagged.similarity ?? 0) > (existing.similarity ?? 0)) {
        byId.set(tagged.id, tagged);
      } else if (
        existingFacet &&
        !taggedFacet
      ) {
        byId.set(tagged.id, existing);
      }
    }
  }

  return {
    results,
    businesses: [...byId.values()],
    fastPathText,
    unknownCapabilities,
  };
}

function isRestaurantBusiness(b: BusinessResult): boolean {
  const meta = b.metadata ?? {};
  const verts = Array.isArray(meta.verticals)
    ? meta.verticals.filter((v): v is string => typeof v === "string")
    : [];
  if (
    verts.includes("restaurants") ||
    verts.includes("nightlife") ||
    verts.includes("cafes")
  ) {
    return true;
  }
  const hay = `${b.name} ${b.category ?? ""} ${b.description ?? ""}`.toLowerCase();
  return /restaurant|dining|bistro|grill|steak|seafood|sushi|pizza|cafe|coffee|cocktail|wine\s*bar|\bbar\b|brunch|fine\s*dining/i.test(
    hay,
  );
}

function isDiningFacetId(
  facetId: string | null,
  facetLabel: string | null | undefined,
): boolean {
  const hay = `${facetId ?? ""} ${facetLabel ?? ""}`.toLowerCase();
  if (!hay.trim()) return false;
  if (/cake|bakery|florist|jewell|photo|dj|entertain|venue|supplies|decor|play|kids/i.test(hay)) {
    return false;
  }
  return /dinner|dining|restaurant|meal|brunch|cocktail|bar|cafe|lunch/i.test(hay);
}
