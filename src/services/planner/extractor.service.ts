import "server-only";
import { zodTextFormat } from "openai/helpers/zod";
import { openai, AI_MODEL } from "@/lib/ai/openai";
import { logAiCall } from "@/lib/ai/logging";
import { promptVersion } from "@/lib/ai/prompts";
import {
  plannerDraftSchema,
  buildPlannerV2System,
} from "@/lib/ai/prompts/planner.v2";
import { wrapUserContent, mapHistoryToModelTurns } from "@/lib/ai/safety";
import type { ConversationContext, PlannerDraft } from "./types";
import { FALLBACK_DRAFT } from "./types";
import {
  getCachedPlannerDraft,
  hashStickyPayload,
  plannerCacheKey,
  setCachedPlannerDraft,
} from "./planner-cache";

export interface ExtractorParams {
  context: ConversationContext;
  message: string;
  userId?: string | null;
  conversationId?: string | null;
}

function stickySnapshot(context: ConversationContext): string {
  const e = context.stickyEntities;
  const c = context.stickyConstraints;
  const parts = [
    e.locations.length ? `locations=${e.locations.join(", ")}` : "",
    e.estates.length ? `estates=${e.estates.join(", ")}` : "",
    e.landmarks.length ? `landmarks=${e.landmarks.join(", ")}` : "",
    e.cuisines.length ? `cuisines=${e.cuisines.join(", ")}` : "",
  ].filter(Boolean);
  const constraintParts = [
    c.openNow != null ? `openNow=${c.openNow}` : "",
    c.budget ? `budget=${c.budget}` : "",
    c.partySize != null ? `partySize=${c.partySize}` : "",
    c.distanceLabel ? `distance=${c.distanceLabel}` : "",
  ].filter(Boolean);
  const sticky = parts.length
    ? `Sticky geo/entities from earlier turns: ${parts.join("; ")}`
    : "Sticky geo/entities from earlier turns: (none)";
  const stickyC = constraintParts.length
    ? `Sticky constraints: ${constraintParts.join("; ")}`
    : "Sticky constraints: (none)";
  const turns = context.history.length;
  return [
    sticky,
    stickyC,
    turns > 0
      ? `This is a follow-up (${turns} prior turns below). Carry forward goal, place, and constraints unless the user clearly changes topic.`
      : "This is the first turn of the conversation.",
  ].join("\n");
}

/**
 * LLM structured extractor — understanding only. Does not decide workflows.
 * Narrow Upstash cache: identical (city, message, sticky) within 10 minutes.
 */
export class PlannerExtractorService {
  async extract(params: ExtractorParams): Promise<PlannerDraft> {
    const { context, message, userId, conversationId } = params;
    const start = Date.now();

    const cacheKey = plannerCacheKey({
      citySlug: context.city.slug,
      message,
      stickyHash: hashStickyPayload({
        entities: context.stickyEntities,
        constraints: context.stickyConstraints,
      }),
    });
    const cached = await getCachedPlannerDraft(cacheKey);
    if (cached) {
      await logAiCall({
        service: "PlannerExtractorService",
        promptVersion: promptVersion("planner_v2"),
        model: AI_MODEL,
        input: { message, cache: "hit" },
        output: cached,
        latencyMs: Date.now() - start,
        status: "success",
        userId,
        conversationId,
      });
      return cached;
    }

    const input = [
      {
        role: "system" as const,
        content: buildPlannerV2System(context.city.name),
      },
      { role: "system" as const, content: stickySnapshot(context) },
      ...mapHistoryToModelTurns(context.history.slice(-6)),
      { role: "user" as const, content: wrapUserContent(message) },
    ];

    try {
      const res = await openai.responses.parse({
        model: AI_MODEL,
        input,
        text: { format: zodTextFormat(plannerDraftSchema, "planner_draft") },
      });

      const parsed = (res.output_parsed as PlannerDraft | null) ?? {
        ...FALLBACK_DRAFT,
        draftQueries: message.trim() ? [message] : [],
        goal: { primary: "fallback", description: message },
      };
      const draft: PlannerDraft = {
        ...FALLBACK_DRAFT,
        ...parsed,
        planFacets: Array.isArray(parsed.planFacets) ? parsed.planFacets : [],
      };

      await setCachedPlannerDraft(cacheKey, draft);

      await logAiCall({
        service: "PlannerExtractorService",
        promptVersion: promptVersion("planner_v2"),
        model: AI_MODEL,
        input: { message, cache: "miss" },
        output: draft,
        inputTokens: res.usage?.input_tokens ?? null,
        outputTokens: res.usage?.output_tokens ?? null,
        latencyMs: Date.now() - start,
        status: "success",
        userId,
        conversationId,
      });

      return draft;
    } catch (err) {
      await logAiCall({
        service: "PlannerExtractorService",
        promptVersion: promptVersion("planner_v2"),
        model: AI_MODEL,
        input: { message },
        latencyMs: Date.now() - start,
        status: "error",
        error: err instanceof Error ? err.message : String(err),
        userId,
        conversationId,
      });

      return {
        ...FALLBACK_DRAFT,
        intent: "fallback",
        goal: { primary: "fallback", description: message },
        draftQueries: message.trim() ? [message] : [],
        notes: "extractor_error",
      };
    }
  }
}

export const plannerExtractorService = new PlannerExtractorService();
