import "server-only";
import { zodTextFormat } from "openai/helpers/zod";
import { openai, AI_MODEL } from "@/lib/ai/openai";
import { logAiCall } from "@/lib/ai/logging";
import { promptVersion } from "@/lib/ai/prompts";
import {
  buildFitVerifySystem,
  fitVerifyResultSchema,
  type FitVerifyResultParsed,
} from "@/lib/ai/prompts/fit-verify.v1";
import { wrapUserContent } from "@/lib/ai/safety";
import { extractAttributes } from "@/lib/schemas/business-attributes";
import type { ExperienceComposition } from "@/services/composition/types";
import type { PlannerPlan } from "@/services/planner/types";
import { applyFitVerifyDecisions } from "./fit-verify-apply";

export { applyFitVerifyDecisions } from "./fit-verify-apply";

export interface FitVerifyParams {
  userMessage: string;
  plan: PlannerPlan;
  composition: ExperienceComposition;
  cityName: string;
  userId?: string | null;
  conversationId?: string | null;
}

function compactCards(composition: ExperienceComposition): unknown[] {
  const byId = new Map(composition.businesses.map((b) => [b.id, b]));
  const cards: unknown[] = [];
  for (const section of composition.sections) {
    for (const id of section.businessIds) {
      const b = byId.get(id);
      if (!b) continue;
      const attrs = extractAttributes(b.metadata);
      cards.push({
        businessId: b.id,
        name: b.name,
        category: b.category,
        description: (b.description ?? "").slice(0, 180),
        sectionTitle: section.title,
        sectionId: section.id,
        facetId:
          typeof b.metadata?.planFacetId === "string"
            ? b.metadata.planFacetId
            : null,
        priceLevel: b.priceLevel,
        rating: b.rating,
        ratingCount: b.ratingCount,
        attrs: {
          romantic: attrs.romantic ?? null,
          familyFriendly: attrs.familyFriendly ?? null,
          breakfast: attrs.breakfast ?? null,
          cocktails: attrs.cocktails ?? null,
          reservations: attrs.reservations ?? null,
          takeaway: attrs.takeaway ?? null,
        },
        address: (b.address ?? "").slice(0, 80) || null,
      });
    }
  }
  return cards.slice(0, 24);
}

export class FitVerifyService {
  async verifyCompositionFit(
    params: FitVerifyParams,
  ): Promise<ExperienceComposition> {
    const start = Date.now();
    const { composition, plan, userMessage, cityName } = params;
    const facets = plan.composition.planFacets ?? [];

    const payload = {
      ask: userMessage,
      goal: plan.goal,
      facets: facets.map((f) => ({ id: f.id, label: f.label })),
      businesses: compactCards(composition),
    };

    try {
      const res = await openai.responses.parse({
        model: AI_MODEL,
        input: [
          { role: "system", content: buildFitVerifySystem(cityName) },
          {
            role: "system",
            content: `Data:\n${JSON.stringify(payload)}`,
          },
          {
            role: "user",
            content: wrapUserContent(
              "Verify each business for this ask. Return decisions for every businessId.",
            ),
          },
        ],
        text: { format: zodTextFormat(fitVerifyResultSchema, "fit_verify") },
      });

      const parsed =
        (res.output_parsed as FitVerifyResultParsed | null) ?? {
          decisions: [],
        };

      const next = applyFitVerifyDecisions(composition, parsed, facets);
      const dropped = composition.businesses.length - next.businesses.length;

      await logAiCall({
        service: "FitVerifyService",
        promptVersion: promptVersion("fit_verify"),
        model: AI_MODEL,
        input: {
          ask: userMessage,
          businessCount: composition.businesses.length,
          facetCount: facets.length,
        },
        output: {
          decisionCount: parsed.decisions.length,
          dropped,
          kept: next.businesses.length,
        },
        inputTokens: res.usage?.input_tokens ?? null,
        outputTokens: res.usage?.output_tokens ?? null,
        latencyMs: Date.now() - start,
        status: "success",
        userId: params.userId,
        conversationId: params.conversationId,
      });

      return next;
    } catch (err) {
      await logAiCall({
        service: "FitVerifyService",
        promptVersion: promptVersion("fit_verify"),
        model: AI_MODEL,
        input: { ask: userMessage },
        latencyMs: Date.now() - start,
        status: "error",
        error: err instanceof Error ? err.message : String(err),
        userId: params.userId,
        conversationId: params.conversationId,
      });
      return composition;
    }
  }
}

export const fitVerifyService = new FitVerifyService();
