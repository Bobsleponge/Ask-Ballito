import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { authorizeCronRequest } from "@/lib/security/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

const RETENTION_DAYS = 90;

/**
 * Delete ai_logs older than 90 days (PII retention policy).
 *
 * Auth: Authorization: Bearer $CRON_SECRET
 */
export async function GET(request: Request) {
  const gate = authorizeCronRequest(request, env.CRON_SECRET);
  if (gate === "missing_secret") {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 503 },
    );
  }
  if (gate === "unauthorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("purge_old_ai_logs", {
      retention_days: RETENTION_DAYS,
    });

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, deleted: data ?? 0 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "ai_logs purge failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
