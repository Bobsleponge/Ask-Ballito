import "server-only";
import { z } from "zod";

/**
 * Server-side environment schema.
 *
 * Core integrations (Supabase, OpenAI) are required so the app fails fast on
 * boot if they are missing. Optional integrations degrade gracefully so the
 * platform still builds and runs while keys are being provisioned.
 */
const serverSchema = z.object({
  // App
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_SITE_URL: z.string().min(1).default("http://localhost:3000"),

  // Supabase (required)
  NEXT_PUBLIC_SUPABASE_URL: z.string().min(1),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_DB_URL: z.string().min(1).optional(),

  // OpenAI (required)
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_MODEL: z.string().min(1).default("gpt-4.1-mini"),
  OPENAI_EMBEDDING_MODEL: z.string().min(1).default("text-embedding-3-small"),
  OPENAI_EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(1536),

  // PostHog (optional)
  NEXT_PUBLIC_POSTHOG_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().min(1).default("https://us.i.posthog.com"),

  // Sentry (optional)
  NEXT_PUBLIC_SENTRY_DSN: z.string().min(1).optional(),
  SENTRY_AUTH_TOKEN: z.string().min(1).optional(),
  SENTRY_ORG: z.string().min(1).optional(),
  SENTRY_PROJECT: z.string().min(1).optional(),

  // Resend (optional)
  RESEND_API_KEY: z.string().min(1).optional(),
  RESEND_FROM_EMAIL: z.string().min(1).default("Ask Ballito <onboarding@resend.dev>"),

  // Google Platform (optional until ingestion/maps are enabled).
  // Treat blank .env values as unset so an empty `KEY=` does not crash boot.
  GOOGLE_PLACES_API_KEY: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().min(1).optional(),
  ),
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().min(1).optional(),
  ),

  // Upstash rate limiting (optional; limiter no-ops when absent)
  UPSTASH_REDIS_REST_URL: z.string().min(1).optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;

function loadEnv(): ServerEnv {
  const parsed = serverSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Invalid or missing environment variables:\n${issues}\n` +
        "Copy .env.example to .env.local and fill in the required values.",
    );
  }

  return parsed.data;
}

export const env = loadEnv();
