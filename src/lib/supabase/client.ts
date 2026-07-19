import { createBrowserClient } from "@supabase/ssr";
import { clientEnv } from "@/lib/env.client";
import type { Database } from "@/types/database";

/**
 * Supabase client for use in Client Components (browser).
 */
export function createClient() {
  return createBrowserClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
