import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * Returns the currently authenticated user (or null). Cached per request.
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});
