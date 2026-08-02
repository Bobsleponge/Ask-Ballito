import "server-only";
import { intelligenceFlags } from "@/config/intelligence-flags";
import { matchKnowledgeCardSeed } from "@/config/knowledge-cards";
import { findKnowledgeCard } from "@/services/knowledge/knowledge-cards.service";
import { businessSearchService } from "@/services/ai/business-search.service";
import { rankBusinesses } from "@/services/ai/ranking.engine";
import { loadRankConfig } from "@/services/ai/rank-config";
import { resolveFromClassification } from "@/services/classifier";
import {
  composeExperience,
  formatCompositionConversational,
} from "@/services/composition";
import type {
  KnowledgeResolution,
  KnowledgeResolverInput,
  KnowledgeResolverPlugin,
} from "../types";

export const knowledgeCardPlugin: KnowledgeResolverPlugin = {
  id: "knowledge-card",
  async resolve(input: KnowledgeResolverInput): Promise<KnowledgeResolution | null> {
    if (!intelligenceFlags.knowledgeCards()) return null;

    const { message, city, classification, context, excludeBusinessIds, retry } =
      input;

    const storedCard = await findKnowledgeCard({
      citySlug: city.slug,
      message,
    });
    if (!storedCard) return null;

    const signals = [`knowledge_card:${storedCard.slug}`];
    const cardIds = storedCard.businessIds.filter((id) => !excludeBusinessIds.has(id));

    if (cardIds.length > 0 && !retry) {
      const loaded = await businessSearchService.getByIds({
        ids: cardIds,
        citySlug: city.slug,
      });
      if (loaded.length > 0) {
        if (storedCard.searchQueries.length > 0) {
          classification.draftQueries = [
            ...storedCard.searchQueries,
            ...classification.draftQueries,
          ];
        }

        let cardPlan = resolveFromClassification(
          classification,
          context,
          message,
        );
        cardPlan = {
          ...cardPlan,
          llmRequired: false,
          responseMode: "execute_and_explain",
          composition: {
            ...cardPlan.composition,
            strategy: "ranked_list",
            titleHint: storedCard.title,
          },
          diagnostics: {
            ...cardPlan.diagnostics,
            rulesApplied: [
              ...cardPlan.diagnostics.rulesApplied,
              "knowledge_card_fast_path",
              "knowledge_resolver:knowledge-card",
            ],
          },
        };

        const ranked = rankBusinesses(
          loaded,
          cardPlan,
          loadRankConfig({
            limit: Math.min(8, loaded.length),
            minKeep: Math.min(3, loaded.length),
            preferVariety: false,
          }),
        );
        const composition = composeExperience(ranked, cardPlan);
        const seed = matchKnowledgeCardSeed(message);
        const text =
          formatCompositionConversational(composition, {
            introHint:
              seed?.bodyTemplate ||
              storedCard.render.headline ||
              storedCard.bodyMd ||
              storedCard.title,
            cityName: city.name,
            servicesTone:
              cardPlan.workflow === "services" ||
              cardPlan.workflow === "healthcare",
          }) || ranked.map((b) => b.name).join(", ");

        return {
          type: "KNOWLEDGE_CARD",
          answered: true,
          confidence: 0.95,
          reason: `Served knowledge card "${storedCard.slug}"`,
          sources: [`knowledge_cards:${storedCard.slug}`],
          nextStage: "return",
          expectedCost: "none",
          expectedLatencyMs: 60,
          pluginId: "knowledge-card",
          text,
          businesses: composition.businesses,
          composition,
          plan: cardPlan,
          signals,
        };
      }
    }

    // No stored members yet — seed search queries and fall through to search.
    const draftQueries =
      storedCard.searchQueries.length > 0
        ? storedCard.searchQueries
        : (matchKnowledgeCardSeed(message)?.searchQueries ?? []);

    return {
      type: "SEARCH",
      answered: false,
      confidence: 0.6,
      reason: `Knowledge card "${storedCard.slug}" matched but has no members yet`,
      sources: [`knowledge_cards:${storedCard.slug}`],
      nextStage: "search",
      expectedCost: "none",
      expectedLatencyMs: 30,
      pluginId: "knowledge-card",
      draftQueries,
      signals,
    };
  },
};
