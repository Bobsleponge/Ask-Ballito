import "server-only";
import { createHash } from "node:crypto";
import { Redis } from "@upstash/redis";
import { env } from "@/lib/env";
import type { PlannerDraft } from "./types";

const TTL_SECONDS = 10 * 60;
const PREFIX = "ask-ballito:planner:v1";

function redis(): Redis | null {
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) return null;
  return new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  });
}

export function plannerCacheKey(params: {
  citySlug: string;
  message: string;
  stickyHash: string;
}): string {
  const normalized = params.message.replace(/\s+/g, " ").trim().toLowerCase();
  const hash = createHash("sha256")
    .update(`${params.citySlug}|${normalized}|${params.stickyHash}`)
    .digest("hex");
  return `${PREFIX}:${hash}`;
}

export function hashStickyPayload(payload: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(payload ?? null))
    .digest("hex")
    .slice(0, 16);
}

export async function getCachedPlannerDraft(
  key: string,
): Promise<PlannerDraft | null> {
  const r = redis();
  if (!r) return null;
  try {
    const hit = await r.get<PlannerDraft>(key);
    if (!hit || typeof hit !== "object") return null;
    return hit;
  } catch {
    return null;
  }
}

export async function setCachedPlannerDraft(
  key: string,
  draft: PlannerDraft,
): Promise<void> {
  const r = redis();
  if (!r) return;
  try {
    await r.set(key, draft, { ex: TTL_SECONDS });
  } catch {
    // ignore cache write failures
  }
}
