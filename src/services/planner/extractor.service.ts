import "server-only";
import { zodTextFormat } from "openai/helpers/zod";
import { openai, AI_MODEL } from "@/lib/ai/openai";
import { logAiCall } from "@/lib/ai/logging";
import { promptVersion } from "@/lib/ai/prompts";
import {
  plannerDraftSchema,
  buildPlannerV2System,
} from "@/lib/ai/prompts/planner.v2";
import { wrapUserContent } from "@/lib/ai/safety";
import type { ConversationContext, PlannerDraft } from "./types";
import { FALLBACK_DRAFT } from "./types";

export interface ExtractorParams {
  context: ConversationContext;
  message: string;
  userId?: string | null;
  conversationId?: string | null;
}

function stickySnapshot(context: ConversationContext): string {
  const e = context.stickyEntities;
  const parts = [
    e.locations.length ? `locations=${e.locations.join(", ")}` : "",
    e.estates.length ? `estates=${e.estates.join(", ")}` : "",
    e.landmarks.length ? `landmarks=${e.landmarks.join(", ")}` : "",
  ].filter(Boolean);
  const sticky = parts.length
    ? `Sticky geo from earlier turns: ${parts.join("; ")}`
    : "Sticky geo from earlier turns: (none)";
  const turns = context.history.length;
  return [
    sticky,
    turns > 0
      ? `This is a follow-up (${turns} prior turns below). Carry forward goal, place, and constraints unless the user clearly changes topic.`
      : "This is the first turn of the conversation.",
  ].join("\n");
}

/**
 * LLM structured extractor — understanding only. Does not decide workflows.
 */
export class PlannerExtractorService {
  async extract(params: ExtractorParams): Promise<PlannerDraft> {
    const { context, message, userId, conversationId } = params;
    const start = Date.now();

    const input = [
      { role: "system" as const, content: buildPlannerV2System(context.city.name) },
      { role: "system" as const, content: stickySnapshot(context) },
      ...context.history.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      })),
      { role: "user" as const, content: wrapUserContent(message) },
    ];

    try {
      const res = await openai.responses.parse({
        model: AI_MODEL,
        input,
        text: { format: zodTextFormat(plannerDraftSchema, "planner_draft") },
      });

      const draft = (res.output_parsed as PlannerDraft | null) ?? {
        ...FALLBACK_DRAFT,
        draftQueries: message.trim() ? [message] : [],
        goal: { primary: "fallback", description: message },
      };

      await logAiCall({
        service: "PlannerExtractorService",
        promptVersion: promptVersion("planner_v2"),
        model: AI_MODEL,
        input: { message },
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
