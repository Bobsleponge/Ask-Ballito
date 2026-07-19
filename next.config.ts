import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  images: {
    // Next 16 blocks local srcs with query strings unless listed here.
    localPatterns: [
      { pathname: "/api/photo" },
      { pathname: "/**", search: "" },
    ],
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "places.googleapis.com" },
    ],
  },
  experimental: {
    // Server Actions are enabled by default in App Router; keep payload sane.
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Only print logs for uploading source maps in CI.
  silent: !process.env.CI,
  // Upload a larger set of source maps for prettier stack traces.
  widenClientFileUpload: true,
  // Route Sentry requests through Next.js to circumvent ad-blockers.
  tunnelRoute: "/monitoring",
});
