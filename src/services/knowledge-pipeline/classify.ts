import "server-only";
import { classifyBusinessTerms } from "@/lib/knowledge/taxonomy";
import type { PipelineContext, PipelineStageResult } from "./types";
import { createAdminClient } from "@/lib/supabase/admin";

/** Offline taxonomy classification for all businesses in a city. */
export async function runClassifyTaxonomyStage(
  ctx: PipelineContext,
): Promise<PipelineStageResult> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("businesses")
    .select("id, metadata")
    .eq("city_slug", ctx.citySlug)
    .limit(5000);

  if (error) {
    return {
      stage: "classify_taxonomy",
      ok: false,
      processed: 0,
      skipped: 0,
      errors: [error.message],
    };
  }

  let processed = 0;
  const errors: string[] = [];
  for (const row of data ?? []) {
    try {
      const meta = (row.metadata as Record<string, unknown>) ?? {};
      const verticals = Array.isArray(meta.verticals)
        ? meta.verticals.filter((v): v is string => typeof v === "string")
        : [];
      await classifyBusinessTerms({
        businessId: row.id,
        metadata: meta,
        verticals,
        source: "heuristic",
        confidence: 0.55,
      });
      processed += 1;
    } catch (err) {
      errors.push(
        `${row.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return {
    stage: "classify_taxonomy",
    ok: errors.length === 0,
    processed,
    skipped: 0,
    errors,
  };
}
