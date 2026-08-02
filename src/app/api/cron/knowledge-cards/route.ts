import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { authorizeCronRequest } from "@/lib/security/cron-auth";
import { refreshAllKnowledgeCards } from "@/services/knowledge/knowledge-cards.service";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Refresh deterministic knowledge cards for Ballito (hybrid search + rank).
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
    const result = await refreshAllKnowledgeCards("ballito");
    return NextResponse.json({
      ok: result.errors.length === 0,
      city: "ballito",
      ...result,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "knowledge card refresh failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
