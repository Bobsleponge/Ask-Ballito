import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

/**
 * Allow local Supabase (http://127.0.0.1:54321) in CSP + next/image when
 * NEXT_PUBLIC_SUPABASE_URL points at a local stack.
 */
function supabaseOrigins(): {
  cspHosts: string[];
  remotePatterns: NonNullable<NextConfig["images"]> extends infer I
    ? I extends { remotePatterns?: infer R }
      ? R
      : never
    : never;
} {
  const patterns: {
    protocol: "http" | "https";
    hostname: string;
    port?: string;
  }[] = [{ protocol: "https", hostname: "*.supabase.co" }];
  const cspHosts = ["https://*.supabase.co", "wss://*.supabase.co"];

  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (raw) {
    try {
      const u = new URL(raw);
      const protocol = u.protocol.replace(":", "") as "http" | "https";
      patterns.push({
        protocol,
        hostname: u.hostname,
        ...(u.port ? { port: u.port } : {}),
      });
      cspHosts.push(`${u.protocol}//${u.host}`);
      if (protocol === "https") {
        cspHosts.push(`wss://${u.host}`);
      } else {
        cspHosts.push(`ws://${u.host}`);
      }
    } catch {
      // ignore invalid env
    }
  }

  return { cspHosts, remotePatterns: patterns };
}

const { cspHosts, remotePatterns: supabaseRemotePatterns } = supabaseOrigins();
const cspImg = cspHosts.filter((h) => !h.startsWith("ws"));
const cspConnect = cspHosts;

/**
 * Baseline Content-Security-Policy for Ask Ballito.
 * Allows Next.js, Supabase Auth, PostHog, Sentry, and Google Maps/Places.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  // Residual risk: Next.js / Google Maps still need unsafe-inline + unsafe-eval until a nonce-based CSP is adopted.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.posthog.com https://us.i.posthog.com https://*.sentry.io https://browser.sentry-cdn.com https://maps.googleapis.com https://*.googleapis.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  `img-src 'self' data: blob: ${cspImg.join(" ")} https://lh3.googleusercontent.com https://places.googleapis.com https://*.posthog.com https://*.googleusercontent.com`,
  "font-src 'self' data: https://fonts.gstatic.com",
  `connect-src 'self' ${cspConnect.join(" ")} https://*.posthog.com https://us.i.posthog.com https://*.sentry.io https://*.ingest.sentry.io https://places.googleapis.com https://maps.googleapis.com https://*.googleapis.com`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
];

const nextConfig: NextConfig = {
  images: {
    // Next 16 blocks local srcs with query strings unless listed here.
    localPatterns: [
      { pathname: "/api/photo" },
      { pathname: "/**", search: "" },
    ],
    remotePatterns: [
      ...supabaseRemotePatterns,
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "places.googleapis.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  experimental: {
    // Server Actions are enabled by default in App Router; keep payload sane.
    serverActions: {
      bodySizeLimit: "10mb",
    },
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
