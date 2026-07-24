import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent } from "@/lib/security/sentry-scrub";

const isProd = process.env.NODE_ENV === "production";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  tracesSampleRate: isProd ? 0.1 : 1.0,
  sendDefaultPii: false,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: isProd ? 0.5 : 1.0,
  debug: false,
  beforeSend(event) {
    return scrubSentryEvent(event);
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
