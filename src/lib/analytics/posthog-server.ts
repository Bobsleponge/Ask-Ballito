import "server-only";
import { PostHog } from "posthog-node";
import { env } from "@/lib/env";

let client: PostHog | null = null;

function getClient(): PostHog | null {
  if (!env.NEXT_PUBLIC_POSTHOG_KEY) return null;
  if (!client) {
    client = new PostHog(env.NEXT_PUBLIC_POSTHOG_KEY, {
      host: env.NEXT_PUBLIC_POSTHOG_HOST,
      // Serverless-friendly: flush immediately.
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return client;
}

export function captureServerEvent(params: {
  distinctId: string;
  event: string;
  properties?: Record<string, unknown>;
}): void {
  const c = getClient();
  if (!c) return;
  c.capture({
    distinctId: params.distinctId,
    event: params.event,
    properties: params.properties,
  });
}
