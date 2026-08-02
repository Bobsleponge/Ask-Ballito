import "server-only";
import { createHash } from "node:crypto";
import { Redis } from "@upstash/redis";
import { env } from "@/lib/env";
import { RANK_CONFIG_VERSION } from "@/config/intelligence-flags";
import type { ExperienceComposition } from "@/services/composition";
import type { BusinessResult } from "@/lib/schemas/business";
import type { PlannerPlan } from "@/services/planner/types";

const TTL_SECONDS = 60 * 60;
const PREFIX = "ask-ballito:answer:v1";

export interface CachedAnswer {
  text: string;
  businesses: BusinessResult[];
  composition: ExperienceComposition;
  planSnapshot: {
    workflow: PlannerPlan["workflow"];
    responseMode: PlannerPlan["responseMode"];
    llmRequired: boolean;
    intent: string;
    goal: PlannerPlan["goal"];
  };
  queryClass: string | null;
  cachedAt: string;
}

function redis(): Redis | null {
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) return null;
  return new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  });
}

export function answerCacheKey(params: {
  citySlug: string;
  message: string;
  stickyHash: string;
  rankConfigVersion?: string;
}): string {
  const normalized = params.message.replace(/\s+/g, " ").trim().toLowerCase();
  const version = params.rankConfigVersion ?? RANK_CONFIG_VERSION;
  const hash = createHash("sha256")
    .update(
      `${params.citySlug}|${normalized}|${params.stickyHash}|${version}`,
    )
    .digest("hex");
  return `${PREFIX}:${hash}`;
}

export async function getCachedAnswer(
  key: string,
): Promise<CachedAnswer | null> {
  const r = redis();
  if (!r) return null;
  try {
    const hit = await r.get<CachedAnswer>(key);
    if (!hit || typeof hit !== "object" || typeof hit.text !== "string") {
      return null;
    }
    return hit;
  } catch {
    return null;
  }
}

export async function setCachedAnswer(
  key: string,
  value: CachedAnswer,
): Promise<void> {
  const r = redis();
  if (!r) return;
  try {
    await r.set(key, value, { ex: TTL_SECONDS });
  } catch {
    // ignore cache write failures
  }
}
