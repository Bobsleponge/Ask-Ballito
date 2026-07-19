"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import { clientEnv } from "@/lib/env.client";

let initialized = false;

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (initialized) return;
    if (!clientEnv.NEXT_PUBLIC_POSTHOG_KEY) return;

    posthog.init(clientEnv.NEXT_PUBLIC_POSTHOG_KEY, {
      api_host: clientEnv.NEXT_PUBLIC_POSTHOG_HOST,
      capture_pageview: false,
      capture_pageleave: true,
      person_profiles: "identified_only",
    });
    initialized = true;
  }, []);

  return <>{children}</>;
}

/**
 * Manual pageview tracking (App Router). Rendered inside Suspense because it
 * uses useSearchParams.
 */
export function PostHogPageview() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!clientEnv.NEXT_PUBLIC_POSTHOG_KEY || !posthog.__loaded) return;
    let url = window.origin + pathname;
    const qs = searchParams.toString();
    if (qs) url += `?${qs}`;
    posthog.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams]);

  return null;
}
