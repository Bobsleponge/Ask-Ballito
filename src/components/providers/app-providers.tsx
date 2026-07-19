"use client";

import { Suspense } from "react";
import { QueryProvider } from "./query-provider";
import { PostHogProvider, PostHogPageview } from "./posthog-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <PostHogProvider>
      <QueryProvider>
        <TooltipProvider delayDuration={200}>
          <Suspense fallback={null}>
            <PostHogPageview />
          </Suspense>
          {children}
          <Toaster richColors position="top-center" />
        </TooltipProvider>
      </QueryProvider>
    </PostHogProvider>
  );
}
