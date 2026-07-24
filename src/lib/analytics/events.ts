"use client";

import posthog from "posthog-js";

/**
 * Central event taxonomy. Keeping event names in one typed place keeps
 * analytics consistent and makes every user interaction trackable.
 */
export type AnalyticsEvent =
  | "app_opened"
  | "city_changed"
  | "search_opened"
  | "search_submitted"
  | "chat_message_sent"
  | "chat_reset"
  | "chat_response_received"
  | "recommendation_shown"
  | "recommendation_retry"
  | "business_viewed"
  | "business_clicked"
  | "auth_started"
  | "auth_completed"
  | "auth_required_shown"
  | "error_shown";

export type AnalyticsProps = Record<string, unknown>;

function isReady(): boolean {
  return typeof window !== "undefined" && Boolean(posthog.__loaded);
}

export const analytics = {
  capture(event: AnalyticsEvent, properties?: AnalyticsProps) {
    if (!isReady()) return;
    posthog.capture(event, properties);
  },
  identify(distinctId: string, properties?: AnalyticsProps) {
    if (!isReady()) return;
    posthog.identify(distinctId, properties);
  },
  reset() {
    if (!isReady()) return;
    posthog.reset();
  },
};
