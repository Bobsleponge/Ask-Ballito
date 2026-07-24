import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent } from "@/lib/security/sentry-scrub";

const isProd = process.env.NODE_ENV === "production";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  // Full sampling in local/dev; reduce cost & PII surface in production.
  tracesSampleRate: isProd ? 0.1 : 1.0,
  sendDefaultPii: false,
  debug: false,
  beforeSend(event) {
    return scrubSentryEvent(event);
  },
});
