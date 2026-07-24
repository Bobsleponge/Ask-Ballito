import "server-only";
import { zodTextFormat } from "openai/helpers/zod";
import { openai, AI_MODEL } from "@/lib/ai/openai";
import { logAiCall } from "@/lib/ai/logging";
import { promptVersion } from "@/lib/ai/prompts";
import {
  intentSchema,
  buildIntentSystem,
  type Intent,
} from "@/lib/ai/prompts/intent.v1";
import { wrapUserContent, mapHistoryToModelTurns } from "@/lib/ai/safety";
import type { City } from "@/config/cities";
import type { ChatMessage } from "@/lib/schemas/chat";

export interface IntentAnalysisParams {
  city: City;
  message: string;
  history?: ChatMessage[];
  userId?: string | null;
  conversationId?: string | null;
}

const FALLBACK_INTENT: Intent = {
  isRecommendationRequest: false,
  category: null,
  keywords: [],
  priceLevel: null,
  openNow: null,
  vibe: [],
  searchQuery: "",
};

/**
 * @deprecated Phase 2 chat path uses PlannerService instead.
 * Kept for reference / any external callers; prefer plannerService.plan().
 */
export class IntentAnalysisService {
  async analyze(params: IntentAnalysisParams): Promise<Intent> {
    const { city, message, history = [], userId, conversationId } = params;
    const start = Date.now();

    const input = [
      { role: "system" as const, content: buildIntentSystem(city.name) },
      ...mapHistoryToModelTurns(history.slice(-6)),
      { role: "user" as const, content: wrapUserContent(message) },
    ];

    try {
      const res = await openai.responses.parse({
        model: AI_MODEL,
        input,
        text: { format: zodTextFormat(intentSchema, "intent") },
      });

      const intent = res.output_parsed ?? FALLBACK_INTENT;

      await logAiCall({
        service: "IntentAnalysisService",
        promptVersion: promptVersion("intent"),
        model: AI_MODEL,
        input: { message },
        output: intent,
        inputTokens: res.usage?.input_tokens ?? null,
        outputTokens: res.usage?.output_tokens ?? null,
        latencyMs: Date.now() - start,
        status: "success",
        userId,
        conversationId,
      });

      return intent;
    } catch (err) {
      await logAiCall({
        service: "IntentAnalysisService",
        promptVersion: promptVersion("intent"),
        model: AI_MODEL,
        input: { message },
        latencyMs: Date.now() - start,
        status: "error",
        error: err instanceof Error ? err.message : String(err),
        userId,
        conversationId,
      });
      // Degrade gracefully: treat as a non-recommendation turn.
      return { ...FALLBACK_INTENT, searchQuery: message };
    }
  }
}

export const intentAnalysisService = new IntentAnalysisService();
