import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env } from "@/lib/env";

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  /** False when Upstash is not configured (dev no-op or prod fail-closed). */
  configured: boolean;
}

type LimiterKind =
  | "chat"
  | "anon"
  | "photo"
  | "publicDiscover"
  | "userDaily"
  | "userMonthly"
  | "userNewAccount"
  | "magicLink"
  | "globalChat"
  | "menuImportUser"
  | "menuImportBusiness";

const limiters: Partial<Record<LimiterKind, Ratelimit>> = {};

/** Shared identifier for the app-wide daily chat ceiling. */
export const GLOBAL_CHAT_LIMIT_ID = "global";

/** App-wide daily chat turn ceiling (must match globalChat limiter). */
export const GLOBAL_CHAT_DAILY_LIMIT = 2000;

/**
 * Signed-in chat turns consume this many daily/monthly units (planner + narration).
 * With a 100-unit daily cap this yields ~50 turns / day.
 */
export const USER_CHAT_TURN_COST = 2;

/** Signed-in monthly unit cap (~1000 turns at USER_CHAT_TURN_COST=2). */
export const USER_CHAT_MONTHLY_LIMIT = 2000;

/** First-24h account ramp: 20 units (~10 turns). */
export const USER_CHAT_NEW_ACCOUNT_LIMIT = 20;
export const USER_CHAT_NEW_ACCOUNT_HOURS = 24;

function redisConfigured(): boolean {
  return Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);
}

/** Whether Upstash credentials are present. */
export function isRateLimitConfigured(): boolean {
  return redisConfigured();
}

function createLimiter(kind: LimiterKind): Ratelimit {
  const redis = new Redis({
    url: env.UPSTASH_REDIS_REST_URL!,
    token: env.UPSTASH_REDIS_REST_TOKEN!,
  });

  switch (kind) {
    case "chat":
      // Authenticated (and anon-under-quota) chat: 20 req / minute.
      return new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(20, "60 s"),
        prefix: "ask-ballito:chat",
        analytics: true,
      });
    case "anon":
      // Anonymous free allowance: 5 turns / 24 hours per IP.
      return new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, "24 h"),
        prefix: "ask-ballito:anon",
        analytics: true,
      });
    case "photo":
      // Photo proxy: 60 req / minute per IP.
      return new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(60, "60 s"),
        prefix: "ask-ballito:photo",
        analytics: true,
      });
    case "publicDiscover":
      // Public discover feeds (/api/trending, /api/events): 60 req / minute per IP.
      return new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(60, "60 s"),
        prefix: "ask-ballito:public-discover",
        analytics: true,
      });
    case "userDaily":
      // Signed-in daily spend cap: 100 units / 24h (USER_CHAT_TURN_COST each).
      return new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(100, "24 h"),
        prefix: "ask-ballito:user-daily",
        analytics: true,
      });
    case "userMonthly":
      // Signed-in monthly spend cap: 2000 units / 30d.
      return new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(USER_CHAT_MONTHLY_LIMIT, "30 d"),
        prefix: "ask-ballito:user-monthly",
        analytics: true,
      });
    case "userNewAccount":
      // First-day ramp: 20 units / 24h for accounts younger than 24h.
      return new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(USER_CHAT_NEW_ACCOUNT_LIMIT, "24 h"),
        prefix: "ask-ballito:user-new",
        analytics: true,
      });
    case "magicLink":
      // Magic-link / OTP: 5 requests / hour per IP or email.
      return new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, "1 h"),
        prefix: "ask-ballito:magic-link",
        analytics: true,
      });
    case "globalChat":
      // App-wide chat ceiling: GLOBAL_CHAT_DAILY_LIMIT turns / 24 hours.
      return new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(GLOBAL_CHAT_DAILY_LIMIT, "24 h"),
        prefix: "ask-ballito:global-chat",
        analytics: true,
      });
    case "menuImportUser":
      // Menu AI import: 5 / hour per user.
      return new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, "1 h"),
        prefix: "ask-ballito:menu-import-user",
        analytics: true,
      });
    case "menuImportBusiness":
      // Menu AI import: 20 / day per business.
      return new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(20, "24 h"),
        prefix: "ask-ballito:menu-import-biz",
        analytics: true,
      });
  }
}

function getLimiter(kind: LimiterKind): Ratelimit | null {
  if (!redisConfigured()) return null;
  if (!limiters[kind]) {
    limiters[kind] = createLimiter(kind);
  }
  return limiters[kind]!;
}

function unconfiguredResult(): RateLimitResult {
  // Production must fail closed; development allows unlimited for local DX.
  if (env.NODE_ENV === "production") {
    return { success: false, limit: 0, remaining: 0, reset: 0, configured: false };
  }
  return { success: true, limit: 0, remaining: 0, reset: 0, configured: false };
}

async function limit(
  kind: LimiterKind,
  identifier: string,
  rate = 1,
): Promise<RateLimitResult> {
  const l = getLimiter(kind);
  if (!l) return unconfiguredResult();
  const result = await l.limit(identifier, { rate });
  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
    configured: true,
  };
}

/**
 * Per-IP / per-user chat burst limit (20 / minute).
 * Fail-closed in production when Upstash is missing.
 */
export async function checkChatRateLimit(
  identifier: string,
): Promise<RateLimitResult> {
  return limit("chat", identifier);
}

/**
 * Anonymous daily chat allowance (5 / 24h per IP).
 * Fail-closed in production when Upstash is missing.
 */
export async function checkAnonymousChatQuota(
  ip: string,
): Promise<RateLimitResult> {
  return limit("anon", ip);
}

/**
 * Signed-in daily chat cap (100 units / 24h per user).
 * Pass `rate` > 1 to weight multi-call turns (default: USER_CHAT_TURN_COST).
 */
export async function checkUserDailyChatQuota(
  userId: string,
  rate: number = USER_CHAT_TURN_COST,
): Promise<RateLimitResult> {
  return limit("userDaily", userId, rate);
}

/**
 * Signed-in monthly chat cap (2000 units / 30d per user).
 */
export async function checkUserMonthlyChatQuota(
  userId: string,
  rate: number = USER_CHAT_TURN_COST,
): Promise<RateLimitResult> {
  return limit("userMonthly", userId, rate);
}

/**
 * New-account ramp (20 units / 24h) for accounts younger than 24 hours.
 */
export async function checkUserNewAccountChatQuota(
  userId: string,
  rate: number = USER_CHAT_TURN_COST,
): Promise<RateLimitResult> {
  return limit("userNewAccount", userId, rate);
}

/**
 * App-wide daily chat ceiling (2000 / 24h). Protects org OpenAI spend.
 */
export async function checkGlobalChatQuota(): Promise<RateLimitResult> {
  return limit("globalChat", GLOBAL_CHAT_LIMIT_ID);
}

/**
 * Photo proxy rate limit (60 / minute per IP).
 */
export async function checkPhotoRateLimit(
  identifier: string,
): Promise<RateLimitResult> {
  return limit("photo", identifier);
}

/**
 * Public discover feeds (/api/trending, /api/events): 60 / minute per IP.
 * Fail-closed in production when Upstash is missing.
 */
export async function checkPublicDiscoverRateLimit(
  identifier: string,
): Promise<RateLimitResult> {
  return limit("publicDiscover", identifier);
}

/**
 * Magic-link / OTP rate limit (5 / hour per identifier).
 */
export async function checkMagicLinkRateLimit(
  identifier: string,
): Promise<RateLimitResult> {
  return limit("magicLink", identifier);
}

/**
 * Menu import AI: 5 / hour per user.
 */
export async function checkMenuImportUserRateLimit(
  userId: string,
): Promise<RateLimitResult> {
  return limit("menuImportUser", userId);
}

/**
 * Menu import AI: 20 / day per business.
 */
export async function checkMenuImportBusinessRateLimit(
  businessId: string,
): Promise<RateLimitResult> {
  return limit("menuImportBusiness", businessId);
}

/**
 * @deprecated Prefer named checkers above.
 */
export async function checkRateLimit(
  identifier: string,
): Promise<RateLimitResult> {
  return checkChatRateLimit(identifier);
}

/**
 * Best-effort client IP extraction.
 * On Vercel, prefer `x-vercel-forwarded-for` (platform-set, harder to spoof).
 */
export function getClientIp(request: Request): string {
  return getClientIpFromHeaders(request.headers);
}

/** Same logic for Server Actions via `next/headers`. */
export function getClientIpFromHeaders(headers: Headers): string {
  const vercel = headers.get("x-vercel-forwarded-for");
  if (vercel) return vercel.split(",")[0]!.trim();

  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();

  return headers.get("x-real-ip")?.trim() || "anonymous";
}
