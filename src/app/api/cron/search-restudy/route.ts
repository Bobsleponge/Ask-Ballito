import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { authorizeCronRequest } from "@/lib/security/cron-auth";
import { businessSearchIngestService } from "@/services/business-portal/business-search-ingest.service";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Batch LLM offerings restudy for businesses whose owner updates are due
 * (scheduled 48h after first dirty change post-ingest).
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
    const result = await businessSearchIngestService.processDueRestudies(25);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Restudy batch failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
