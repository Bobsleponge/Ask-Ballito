import { z } from "zod";

/**
 * Client-safe environment schema. Only NEXT_PUBLIC_* variables are referenced
 * here so this module can be safely imported from Client Components. Next.js
 * statically inlines these at build time.
 */
const clientSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().min(1).default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().min(1),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_POSTHOG_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().min(1).default("https://us.i.posthog.com"),
  NEXT_PUBLIC_SENTRY_DSN: z.string().min(1).optional(),
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: z.string().min(1).optional(),
});

export type ClientEnv = z.infer<typeof clientSchema>;

// Reference variables explicitly so the Next.js compiler inlines them.
const clientEnv = clientSchema.parse({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
  NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
});

export { clientEnv };
