import "server-only";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export function normalizeQuery(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

export function hashQuery(norm: string): string {
  return createHash("sha256").update(norm).digest("hex").slice(0, 32);
}

/**
 * Best-effort append to search_events for trending. Never throws to callers.
 */
export async function recordSearchEvent(params: {
  citySlug: string;
  query: string;
  userId?: string | null;
  sessionId?: string | null;
  source?: string;
}): Promise<void> {
  const queryRaw = params.query.trim();
  if (!queryRaw || queryRaw.length > 2000) return;

  const queryNorm = normalizeQuery(queryRaw);
  if (!queryNorm) return;

  try {
    const admin = createAdminClient();
    await admin.from("search_events").insert({
      city_slug: params.citySlug,
      query_raw: queryRaw.slice(0, 2000),
      query_norm: queryNorm.slice(0, 500),
      query_hash: hashQuery(queryNorm),
      user_id: params.userId ?? null,
      session_id: params.sessionId ?? null,
      source: params.source ?? "chat",
    });
  } catch {
    // Table may not exist yet locally; trending falls back to seeds.
  }
}
