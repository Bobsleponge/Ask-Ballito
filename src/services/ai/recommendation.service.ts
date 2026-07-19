import "server-only";
import { openai, AI_MODEL } from "@/lib/ai/openai";
import { logAiCall } from "@/lib/ai/logging";
import { promptVersion, type PromptName } from "@/lib/ai/prompts";
import {
  buildBusinessContext,
  buildCompositionContext,
  type RecommendationBusiness,
} from "@/lib/ai/prompts/recommendation.v1";
import { wrapUserContent } from "@/lib/ai/safety";
import type { ChatMessage } from "@/lib/schemas/chat";
import type { ExperienceComposition } from "@/services/composition/types";

export interface GenerateParams {
  system: string;
  userMessage: string;
  promptName: PromptName;
  history?: ChatMessage[];
  businesses?: RecommendationBusiness[];
  composition?: ExperienceComposition;
  userId?: string | null;
  conversationId?: string | null;
}

function buildInput(params: GenerateParams) {
  const { system, userMessage, history = [], businesses, composition } = params;
  const input: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: system },
  ];
  if (composition) {
    input.push({
      role: "system",
      content: buildCompositionContext(composition),
    });
  } else if (businesses) {
    input.push({ role: "system", content: buildBusinessContext(businesses) });
  }
  for (const m of history.slice(-8)) {
    input.push({ role: m.role, content: m.content });
  }
  input.push({ role: "user", content: wrapUserContent(userMessage) });
  return input;
}

/**
 * Composes the concierge's natural-language answer, grounded in experience
 * sections (or a flat candidate list). Supports streaming and complete().
 */
export class RecommendationService {
  async complete(params: GenerateParams): Promise<string> {
    const start = Date.now();
    const input = buildInput(params);
    try {
      const res = await openai.responses.create({ model: AI_MODEL, input });
      const text = res.output_text ?? "";
      await logAiCall({
        service: "RecommendationService",
        promptVersion: promptVersion(params.promptName),
        model: AI_MODEL,
        input: {
          userMessage: params.userMessage,
          businessCount:
            params.composition?.businesses.length ??
            params.businesses?.length ??
            0,
          strategy: params.composition?.strategy ?? null,
        },
        output: { text },
        inputTokens: res.usage?.input_tokens ?? null,
        outputTokens: res.usage?.output_tokens ?? null,
        latencyMs: Date.now() - start,
        status: "success",
        userId: params.userId,
        conversationId: params.conversationId,
      });
      return text;
    } catch (err) {
      await logAiCall({
        service: "RecommendationService",
        promptVersion: promptVersion(params.promptName),
        model: AI_MODEL,
        input: { userMessage: params.userMessage },
        latencyMs: Date.now() - start,
        status: "error",
        error: err instanceof Error ? err.message : String(err),
        userId: params.userId,
        conversationId: params.conversationId,
      });
      throw err;
    }
  }

  async *stream(params: GenerateParams): AsyncGenerator<string, void, unknown> {
    const start = Date.now();
    const input = buildInput(params);
    let full = "";
    let inputTokens: number | null = null;
    let outputTokens: number | null = null;

    try {
      const stream = await openai.responses.create({
        model: AI_MODEL,
        input,
        stream: true,
      });

      for await (const event of stream) {
        if (event.type === "response.output_text.delta") {
          full += event.delta;
          yield event.delta;
        } else if (event.type === "response.completed") {
          inputTokens = event.response.usage?.input_tokens ?? null;
          outputTokens = event.response.usage?.output_tokens ?? null;
        }
      }

      await logAiCall({
        service: "RecommendationService",
        promptVersion: promptVersion(params.promptName),
        model: AI_MODEL,
        input: {
          userMessage: params.userMessage,
          businessCount:
            params.composition?.businesses.length ??
            params.businesses?.length ??
            0,
          strategy: params.composition?.strategy ?? null,
        },
        output: { text: full },
        inputTokens,
        outputTokens,
        latencyMs: Date.now() - start,
        status: "success",
        userId: params.userId,
        conversationId: params.conversationId,
      });
    } catch (err) {
      await logAiCall({
        service: "RecommendationService",
        promptVersion: promptVersion(params.promptName),
        model: AI_MODEL,
        input: { userMessage: params.userMessage },
        output: { partial: full },
        latencyMs: Date.now() - start,
        status: "error",
        error: err instanceof Error ? err.message : String(err),
        userId: params.userId,
        conversationId: params.conversationId,
      });
      throw err;
    }
  }
}

export const recommendationService = new RecommendationService();
