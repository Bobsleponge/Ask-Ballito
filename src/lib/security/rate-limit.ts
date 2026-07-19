import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env } from "@/lib/env";

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

let limiter: Ratelimit | null = null;

function getLimiter(): Ratelimit | null {
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  if (!limiter) {
    limiter = new Ratelimit({
      redis: new Redis({
        url: env.UPSTASH_REDIS_REST_URL,
        token: env.UPSTASH_REDIS_REST_TOKEN,
      }),
      // 20 requests per minute per identifier.
      limiter: Ratelimit.slidingWindow(20, "60 s"),
      prefix: "ask-ballito",
      analytics: true,
    });
  }
  return limiter;
}

/**
 * Enforce a rate limit for the given identifier. If Upstash is not configured,
 * the limiter no-ops (always allows) so the app still runs in development.
 */
export async function checkRateLimit(identifier: string): Promise<RateLimitResult> {
  const l = getLimiter();
  if (!l) {
    return { success: true, limit: 0, remaining: 0, reset: 0 };
  }
  return l.limit(identifier);
}

/** Best-effort client IP extraction from request headers. */
export function getClientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return request.headers.get("x-real-ip")?.trim() || "anonymous";
}
