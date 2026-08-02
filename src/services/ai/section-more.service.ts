import "server-only";
import type { City } from "@/config/cities";
import type { BusinessResult } from "@/lib/schemas/business";
import { sanitizeUserInput } from "@/lib/ai/safety";
import {
  filterByVerticalHint,
  verticalHintFromPlan,
} from "@/lib/business-vertical-filter";
import { intelligenceFlags } from "@/config/intelligence-flags";
import { businessSearchService } from "@/services/ai/business-search.service";
import { rankBusinesses } from "@/services/ai/ranking.engine";
import { loadRankConfig } from "@/services/ai/rank-config";
import {
  classifyQuery,
  resolveFromClassification,
} from "@/services/classifier";
import { buildConversationContext } from "@/services/planner";
import {
  filterElevatedCasualDining,
  isElevatedCelebrationAsk,
  isDiningPlanFacet,
} from "@/services/planner/special-occasion-intent";
import { findKnowledgeCard } from "@/services/knowledge/knowledge-cards.service";
import { runExecutionPlan } from "@/services/capabilities";
import { getWorkflowDefinition } from "@/services/workflows/definitions";
import type { PlannerPlan } from "@/services/planner/types";

export interface SectionMoreParams {
  city: City;
  sectionId: string;
  sectionTitle: string;
  ask?: string;
  excludeBusinessIds: string[];
  limit?: number;
}

function mergeById(
  primary: BusinessResult[],
  extras: BusinessResult[],
): BusinessResult[] {
  const byId = new Map<string, BusinessResult>();
  for (const b of primary) byId.set(b.id, b);
  for (const b of extras) {
    if (!byId.has(b.id)) byId.set(b.id, b);
  }
  return [...byId.values()];
}

function withoutExcluded(
  businesses: BusinessResult[],
  exclude: Set<string>,
): BusinessResult[] {
  return businesses.filter((b) => !exclude.has(b.id));
}

function facetIdFromSection(sectionId: string): string | null {
  if (!sectionId.startsWith("facet_")) return null;
  const raw = sectionId.replace(/^facet_/, "");
  return raw.split("__")[0] || raw || null;
}

function filterToSectionFacet(
  businesses: BusinessResult[],
  sectionId: string,
  sectionTitle: string,
): BusinessResult[] {
  const facetId = facetIdFromSection(sectionId);
  if (!facetId) return businesses;

  const matched = businesses.filter((b) => {
    const id =
      typeof b.metadata?.planFacetId === "string"
        ? b.metadata.planFacetId
        : null;
    const label =
      typeof b.metadata?.planFacetLabel === "string"
        ? b.metadata.planFacetLabel
        : null;
    if (id && (id === facetId || id === sectionId)) return true;
    if (label && label.toLowerCase() === sectionTitle.toLowerCase()) return true;
    return false;
  });

  // Prefer facet-tagged hits when present; otherwise keep the full pool.
  return matched.length > 0 ? matched : businesses;
}

function shapeKnowledgeCardPlan(
  plan: PlannerPlan,
  cardTitle: string,
): PlannerPlan {
  return {
    ...plan,
    llmRequired: false,
    responseMode: "execute_and_explain",
    composition: {
      ...plan.composition,
      strategy: "ranked_list",
      titleHint: cardTitle,
    },
    diagnostics: {
      ...plan.diagnostics,
      rulesApplied: [
        ...plan.diagnostics.rulesApplied,
        "knowledge_card_section_more",
      ],
    },
  };
}

/**
 * Fetch additional businesses for one composition section, excluding ids
 * already shown. Mirrors the initial-results retrieve+rank path (knowledge
 * card members / classifier plan → hybrid search → workflow rank config).
 * No narration — cards only.
 */
export async function fetchMoreForSection(
  params: SectionMoreParams,
): Promise<BusinessResult[]> {
  const {
    city,
    sectionId,
    sectionTitle,
    excludeBusinessIds,
    limit: rawLimit = 6,
  } = params;
  const limit = Math.min(Math.max(rawLimit, 1), 12);
  const exclude = new Set(
    excludeBusinessIds.map((id) => id.trim()).filter(Boolean),
  );

  const askRaw = (params.ask ?? "").trim() || sectionTitle;
  const ask = sanitizeUserInput(askRaw).sanitized || sectionTitle;
  const context = buildConversationContext({ city });
  const classification = classifyQuery({
    message: ask,
    citySlug: city.slug,
  });

  // --- Knowledge card path (same source of truth as initial fast path) ---
  if (intelligenceFlags.knowledgeCards()) {
    const storedCard = await findKnowledgeCard({
      citySlug: city.slug,
      message: ask,
    });
    if (storedCard) {
      if (storedCard.searchQueries.length > 0) {
        classification.draftQueries = [
          ...storedCard.searchQueries,
          ...classification.draftQueries,
        ];
      }

      const remainingIds = storedCard.businessIds.filter(
        (id) => !exclude.has(id),
      );
      let pool: BusinessResult[] = [];
      if (remainingIds.length > 0) {
        pool = await businessSearchService.getByIds({
          ids: remainingIds,
          citySlug: city.slug,
        });
      }

      // Members exhausted / short — same overflow as initial: card search queries.
      if (pool.length < limit) {
        const queries =
          storedCard.searchQueries.length > 0
            ? storedCard.searchQueries
            : classification.draftQueries.length > 0
              ? classification.draftQueries
              : [`${sectionTitle} ${city.name}`];
        const extras = await businessSearchService.searchMany({
          city,
          queries,
          limitPerQuery: Math.max(limit * 3, 16),
        });
        pool = mergeById(pool, withoutExcluded(extras, exclude));
      }

      pool = withoutExcluded(pool, exclude);
      if (pool.length === 0) return [];

      const cardPlan = shapeKnowledgeCardPlan(
        resolveFromClassification(classification, context, ask),
        storedCard.title,
      );
      const ranked = rankBusinesses(
        pool,
        cardPlan,
        loadRankConfig({
          limit: Math.min(Math.max(limit * 2, 12), pool.length),
          minKeep: Math.min(limit, 3),
          // Initial card path uses false; for "more" we want distinct leftovers.
          preferVariety: true,
        }),
      );
      return withoutExcluded(ranked, exclude).slice(0, limit);
    }
  }

  // --- Plan path (classifier → execution → workflow rank, like initial) ---
  // Bias retrieval toward this section without dropping the original ask.
  const sectionQuery = `${sectionTitle} ${city.name}`.trim();
  if (
    sectionTitle &&
    !classification.draftQueries.some(
      (q) => q.toLowerCase() === sectionQuery.toLowerCase(),
    )
  ) {
    classification.draftQueries = [
      sectionQuery,
      ...classification.draftQueries,
    ];
  }

  let plan = resolveFromClassification(classification, context, ask);
  plan = {
    ...plan,
    composition: {
      ...plan.composition,
      titleHint: sectionTitle || plan.composition.titleHint,
    },
    diagnostics: {
      ...plan.diagnostics,
      rulesApplied: [...plan.diagnostics.rulesApplied, "section_more"],
    },
  };

  const execution = await runExecutionPlan({
    plan,
    city,
    message: ask,
  });

  let candidates = withoutExcluded(execution.businesses, exclude);

  // Deepen with a section-scoped search (same hybrid service as capabilities).
  const sectionHits = await businessSearchService.search({
    city,
    query: sectionQuery || `${ask.slice(0, 120)} ${city.name}`,
    limit: Math.max(limit * 4, 24),
  });
  candidates = mergeById(candidates, withoutExcluded(sectionHits, exclude));

  candidates = filterToSectionFacet(candidates, sectionId, sectionTitle);

  const def = getWorkflowDefinition(plan.workflow);
  const verticalHint =
    plan.workflow === "special_occasion"
      ? null
      : verticalHintFromPlan(plan);

  if (
    verticalHint === "restaurants" ||
    plan.workflow === "restaurants"
  ) {
    candidates = filterByVerticalHint(candidates, "restaurants");
  } else if (verticalHint) {
    candidates = filterByVerticalHint(candidates, verticalHint);
  }

  const dining =
    isDiningPlanFacet({
      label: sectionTitle,
      searchQuery: `${sectionId} ${sectionTitle}`,
      verticalHint: /dinner|dining|restaurant|cocktail|bar|brunch|cafe/i.test(
        `${sectionId} ${sectionTitle}`,
      )
        ? "restaurants"
        : null,
    }) || plan.workflow === "restaurants";

  if (dining && isElevatedCelebrationAsk(ask)) {
    const facetId = facetIdFromSection(sectionId) || "dinner";
    candidates = candidates.map((b) => ({
      ...b,
      metadata: {
        ...(b.metadata ?? {}),
        planFacetId:
          typeof b.metadata?.planFacetId === "string"
            ? b.metadata.planFacetId
            : facetId,
      },
    }));
    candidates = filterElevatedCasualDining(candidates, {
      elevated: true,
      facets: [
        {
          id: facetId,
          label: sectionTitle,
          searchQuery: sectionTitle,
          verticalHint: "restaurants",
        },
      ],
    });
  }

  candidates = withoutExcluded(candidates, exclude);
  if (candidates.length === 0) return [];

  const ranked = rankBusinesses(candidates, plan, {
    ...loadRankConfig(def.rankConfig),
    verticalHint:
      plan.workflow === "special_occasion"
        ? dining
          ? "restaurants"
          : null
        : verticalHint,
    preferVariety: true,
    limit: Math.max(limit * 3, 18),
    minKeep: Math.min(limit, 4),
  });

  return withoutExcluded(ranked, exclude).slice(0, limit);
}
