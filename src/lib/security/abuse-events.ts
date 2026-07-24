import "server-only";
import * as Sentry from "@sentry/nextjs";
import { captureServerEvent } from "@/lib/analytics/posthog-server";

export type AbuseEventName =
  | "rate_limited"
  | "anon_quota_exhausted"
  | "auth_required"
  | "injection_flagged"
  | "user_daily_cap"
  | "user_monthly_cap"
  | "user_new_account_cap"
  | "global_chat_cap"
  | "ai_budget_threshold"
  | "abuse_suspended"
  | "upstream_ai_unavailable"
  | "grounding_violation"
  | "magic_link_rate_limited"
  | "menu_import_rate_limited";

/**
 * Emit abuse / security telemetry to PostHog + Sentry breadcrumbs.
 * Never throws.
 */
export function captureAbuseEvent(params: {
  event: AbuseEventName;
  distinctId?: string | null;
  properties?: Record<string, unknown>;
}): void {
  const distinctId = params.distinctId ?? "anonymous";
  try {
    captureServerEvent({
      distinctId,
      event: params.event,
      properties: params.properties,
    });
    Sentry.addBreadcrumb({
      category: "abuse",
      message: params.event,
      level: "warning",
      data: params.properties,
    });
  } catch {
    // telemetry must not break the request
  }
}
