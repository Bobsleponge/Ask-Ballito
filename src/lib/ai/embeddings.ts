import "server-only";
import { createHash } from "node:crypto";
import { Redis } from "@upstash/redis";
import { env } from "@/lib/env";
import { openai, EMBEDDING_MODEL, EMBEDDING_DIMENSIONS } from "./openai";

/**
 * Format a numeric vector as a pgvector literal string, e.g. "[0.1,0.2,...]".
 * Supabase expects this string form for vector columns and RPC args.
 */
export function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

function normalizeForEmbed(text: string): string {
  return text.replace(/\n+/g, " ").trim().slice(0, 8000);
}

function cacheKey(normalized: string): string {
  const hash = createHash("sha256").update(normalized).digest("hex");
  return `ask-ballito:embed:v1:${EMBEDDING_MODEL}:${hash}`;
}

function redis(): Redis | null {
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) return null;
  return new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  });
}

/**
 * Create an embedding for a single piece of text (Upstash-cached when configured).
 */
export async function embedText(text: string): Promise<number[]> {
  const input = normalizeForEmbed(text);
  const key = cacheKey(input);
  const r = redis();

  if (r) {
    try {
      const hit = await r.get<number[]>(key);
      if (Array.isArray(hit) && hit.length === EMBEDDING_DIMENSIONS) {
        return hit;
      }
    } catch {
      // cache miss / redis error — fall through
    }
  }

  const res = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input,
    dimensions: EMBEDDING_DIMENSIONS,
  });
  const embedding = res.data[0]!.embedding;

  if (r) {
    try {
      await r.set(key, embedding, { ex: 24 * 60 * 60 });
    } catch {
      // ignore cache write failures
    }
  }

  return embedding;
}

/**
 * Create embeddings for many texts in a single request (no per-item cache).
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const input = texts.map((t) => normalizeForEmbed(t));
  const res = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input,
    dimensions: EMBEDDING_DIMENSIONS,
  });
  return res.data
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}
