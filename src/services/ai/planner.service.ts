import "server-only";
import { zodTextFormat } from "openai/helpers/zod";
import { openai, AI_MODEL } from "@/lib/ai/openai";
import { logAiCall } from "@/lib/ai/logging";
import { promptVersion } from "@/lib/ai/prompts";
import {
  plannerResultSchema,
  buildPlannerSystem,
  FALLBACK_PLAN,
  type PlannerResult,
} from "@/lib/ai/prompts/planner.v1";
import { wrapUserContent } from "@/lib/ai/safety";
import type { City } from "@/config/cities";
import type { ChatMessage } from "@/lib/schemas/chat";

export interface PlannerParams {
  city: City;
  message: string;
  history?: ChatMessage[];
  userId?: string | null;
  conversationId?: string | null;
}

/**
 * Plans the user's turn: goal, workflow, entities, constraints, and search queries.
 * Application code selects workflows and ranks results — the planner only structures intent.
 */
export class PlannerService {
  async plan(params: PlannerParams): Promise<PlannerResult> {
    const { city, message, history = [], userId, conversationId } = params;
    const start = Date.now();

    const input = [
      { role: "system" as const, content: buildPlannerSystem(city.name) },
      ...history.slice(-6).map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: wrapUserContent(message) },
    ];

    try {
      const res = await openai.responses.parse({
        model: AI_MODEL,
        input,
        text: { format: zodTextFormat(plannerResultSchema, "planner") },
      });

      const plan = res.output_parsed ?? {
        ...FALLBACK_PLAN,
        searchQueries: message.trim() ? [message] : [],
      };

      await logAiCall({
        service: "PlannerService",
        promptVersion: promptVersion("planner"),
        model: AI_MODEL,
        input: { message },
        output: plan,
        inputTokens: res.usage?.input_tokens ?? null,
        outputTokens: res.usage?.output_tokens ?? null,
        latencyMs: Date.now() - start,
        status: "success",
        userId,
        conversationId,
      });

      return plan;
    } catch (err) {
      await logAiCall({
        service: "PlannerService",
        promptVersion: promptVersion("planner"),
        model: AI_MODEL,
        input: { message },
        latencyMs: Date.now() - start,
        status: "error",
        error: err instanceof Error ? err.message : String(err),
        userId,
        conversationId,
      });

      return {
        ...FALLBACK_PLAN,
        intent: "fallback",
        goal: message,
        searchQueries: message.trim() ? [message] : [],
      };
    }
  }
}

export const plannerService = new PlannerService();
