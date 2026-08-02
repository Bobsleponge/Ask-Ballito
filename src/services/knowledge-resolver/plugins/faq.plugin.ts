import "server-only";
import { matchFaq } from "@/config/local-knowledge";
import { matchCityFaq } from "@/lib/knowledge/city-knowledge";
import type {
  KnowledgeResolution,
  KnowledgeResolverInput,
  KnowledgeResolverPlugin,
} from "../types";

export const faqPlugin: KnowledgeResolverPlugin = {
  id: "faq",
  async resolve(input: KnowledgeResolverInput): Promise<KnowledgeResolution | null> {
    const { message, city, classification } = input;
    const likelyFaq =
      classification.signals.includes("faq_match") ||
      matchFaq(message) != null ||
      (classification.queryClass === "FACT" &&
        classification.suggestedWorkflow === "general");

    if (!likelyFaq) return null;

    const text = await matchCityFaq({ citySlug: city.slug, message });
    if (!text) return null;

    return {
      type: "FACT",
      answered: true,
      confidence: 0.97,
      reason: "Matched city FAQ / product meta question",
      sources: ["city_faqs", "local-knowledge:faq"],
      nextStage: "return",
      expectedCost: "none",
      expectedLatencyMs: 40,
      pluginId: "faq",
      text,
      businesses: [],
      composition: null,
      signals: ["knowledge_resolver:faq"],
    };
  },
};
