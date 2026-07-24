import "server-only";
import { GLOBAL_CHAT_DAILY_LIMIT, type RateLimitResult } from "@/lib/security/rate-limit";
import { captureAbuseEvent } from "@/lib/security/abuse-events";

const THRESHOLDS = [50, 75, 90, 100] as const;

function budgetCeiling(globalLimit: number): number {
  const raw = process.env.AI_DAILY_BUDGET_TURNS;
  if (!raw) return globalLimit > 0 ? globalLimit : GLOBAL_CHAT_DAILY_LIMIT;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : GLOBAL_CHAT_DAILY_LIMIT;
}

/**
 * Emit ai_budget_threshold when global chat usage first crosses
 * 50/75/90/100% of AI_DAILY_BUDGET_TURNS (default: global limiter ceiling).
 * Call after a successful global quota check.
 */
export function maybeEmitAiBudgetAlerts(
  global: RateLimitResult,
  distinctId?: string | null,
): void {
  if (!global.configured || global.limit <= 0) return;

  const ceiling = budgetCeiling(global.limit);
  const used = Math.max(0, global.limit - global.remaining);

  for (const threshold of THRESHOLDS) {
    const thresholdUsed = Math.ceil((threshold / 100) * ceiling);
    if (used < thresholdUsed) continue;
    if (used - 1 >= thresholdUsed) continue;

    captureAbuseEvent({
      event: "ai_budget_threshold",
      distinctId: distinctId ?? "global",
      properties: {
        threshold_pct: threshold,
        used,
        ceiling,
        remaining: global.remaining,
        limit: global.limit,
      },
    });
  }
}
