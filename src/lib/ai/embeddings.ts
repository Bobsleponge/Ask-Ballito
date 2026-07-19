import "server-only";
import { openai, EMBEDDING_MODEL, EMBEDDING_DIMENSIONS } from "./openai";

/**
 * Format a numeric vector as a pgvector literal string, e.g. "[0.1,0.2,...]".
 * Supabase expects this string form for vector columns and RPC args.
 */
export function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

/**
 * Create an embedding for a single piece of text.
 */
export async function embedText(text: string): Promise<number[]> {
  const input = text.replace(/\n+/g, " ").trim().slice(0, 8000);
  const res = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input,
    dimensions: EMBEDDING_DIMENSIONS,
  });
  return res.data[0].embedding;
}

/**
 * Create embeddings for many texts in a single request.
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const input = texts.map((t) => t.replace(/\n+/g, " ").trim().slice(0, 8000));
  const res = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input,
    dimensions: EMBEDDING_DIMENSIONS,
  });
  return res.data
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}
