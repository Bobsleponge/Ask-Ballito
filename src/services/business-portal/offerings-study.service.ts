import "server-only";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { openai, AI_MODEL } from "@/lib/ai/openai";
import { logAiCall } from "@/lib/ai/logging";
import { offeringsStudySuggestionSchema } from "@/lib/schemas/offerings-study";
import type { OfferingsStudySuggestion } from "@/lib/schemas/offerings-study";
import type { BusinessMenuItemInput } from "@/lib/schemas/business-offerings";

const parseSchema = z.object({
  services: z.array(z.string()).max(40).default([]),
  keywords: z.array(z.string()).max(40).default([]),
  summary: z.string().nullable().optional(),
});

function normalizeTerms(terms: string[], max: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of terms) {
    const t = raw.trim().toLowerCase().replace(/\s+/g, " ");
    if (!t || t.length < 2 || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

function itemsToCorpus(items: BusinessMenuItemInput[]): string {
  return items
    .map((item) => {
      const parts = [item.name.trim()];
      if (item.category?.trim()) parts.push(`(${item.category.trim()})`);
      if (item.description?.trim()) parts.push(item.description.trim());
      if (item.price?.trim()) parts.push(item.price.trim());
      return parts.join(" ");
    })
    .filter(Boolean)
    .join("\n");
}

/**
 * Study owner offerings (menu / service list) and propose search services +
 * keywords. Works for any industry — restaurants, trades, salons, etc.
 * Suggestions are drafts for the owner to confirm; never auto-publish.
 */
export class OfferingsStudyService {
  async study(params: {
    businessName: string;
    category?: string | null;
    verticals?: string[];
    items: BusinessMenuItemInput[];
    existingServices?: string[];
    existingKeywords?: string[];
  }): Promise<OfferingsStudySuggestion> {
    const start = Date.now();
    const corpus = itemsToCorpus(params.items);
    if (corpus.length < 8) {
      return { services: [], keywords: [], summary: null };
    }

    const verticalHint =
      params.verticals?.length
        ? `Industry verticals: ${params.verticals.join(", ")}.`
        : "";
    const categoryHint = params.category
      ? `Category: ${params.category}.`
      : "";

    try {
      const res = await openai.responses.parse({
        model: AI_MODEL,
        input: [
          {
            role: "system",
            content: [
              "You turn a business's real offerings list into searchable profile terms for a local discovery app.",
              "Only use what is clearly present in the offerings text — never invent typical industry services.",
              "services: concrete things customers ask for (dishes, treatments, trades, classes). Prefer short noun phrases.",
              "keywords: extra search aliases, techniques, cuisines, specialties drawn from the same evidence. Lowercase.",
              "Skip prices, addresses, and marketing fluff.",
              "Empty arrays are correct when evidence is thin.",
              "Works for restaurants, salons, plumbers, gyms, clinics — adapt to whatever the list actually contains.",
            ].join(" "),
          },
          {
            role: "user",
            content: [
              `Business: ${params.businessName}`,
              categoryHint,
              verticalHint,
              params.existingServices?.length
                ? `Already listed services (do not merely repeat; add missing): ${params.existingServices.join(", ")}`
                : "",
              params.existingKeywords?.length
                ? `Already listed keywords: ${params.existingKeywords.join(", ")}`
                : "",
              "OFFERINGS / MENU / SERVICE LIST:",
              corpus.slice(0, 14000),
            ]
              .filter(Boolean)
              .join("\n"),
          },
        ],
        text: {
          format: zodTextFormat(parseSchema, "offerings_study"),
        },
      });

      const parsed = res.output_parsed ?? {
        services: [],
        keywords: [],
        summary: null,
      };
      const result = offeringsStudySuggestionSchema.parse({
        services: normalizeTerms(parsed.services ?? [], 40),
        keywords: normalizeTerms(parsed.keywords ?? [], 40),
        summary: parsed.summary?.trim() || null,
      });

      await logAiCall({
        service: "OfferingsStudyService",
        promptVersion: "offerings_study.v1",
        model: AI_MODEL,
        input: {
          name: params.businessName,
          itemCount: params.items.length,
        },
        output: result,
        inputTokens: res.usage?.input_tokens ?? null,
        outputTokens: res.usage?.output_tokens ?? null,
        latencyMs: Date.now() - start,
        status: "success",
      });

      return result;
    } catch (error) {
      await logAiCall({
        service: "OfferingsStudyService",
        promptVersion: "offerings_study.v1",
        model: AI_MODEL,
        input: { name: params.businessName, itemCount: params.items.length },
        output: null,
        latencyMs: Date.now() - start,
        status: "error",
        error:
          error instanceof Error ? error.message : "offerings study failed",
      });
      throw error;
    }
  }
}

export const offeringsStudyService = new OfferingsStudyService();
