import "server-only";
import OpenAI from "openai";
import { env } from "@/lib/env";

/**
 * Shared OpenAI client. Uses the latest official SDK. All feature code should
 * use the Responses API (client.responses.*) rather than legacy Chat
 * Completions.
 */
export const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

export const AI_MODEL = env.OPENAI_MODEL;
export const EMBEDDING_MODEL = env.OPENAI_EMBEDDING_MODEL;
export const EMBEDDING_DIMENSIONS = env.OPENAI_EMBEDDING_DIMENSIONS;
