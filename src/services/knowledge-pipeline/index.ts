import "server-only";
/**
 * Knowledge Pipeline orchestrator.
 *
 * Stages run offline (ingest / enrich / cron). Query path must never call
 * extract_metadata with allowLlm=true.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { runNormalizeStage } from "./normalize";
import { runConfidenceStage } from "./confidence";
import { runClassifyTaxonomyStage } from "./classify";
import type { PipelineContext, PipelineRunResult, PipelineStageResult } from "./types";

export async function runKnowledgePipeline(
  ctx: PipelineContext,
): Promise<PipelineRunResult> {
  const startedAt = new Date().toISOString();
  const stages: PipelineStageResult[] = [];

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("businesses")
    .select("id, name, phone, website, field_meta")
    .eq("city_slug", ctx.citySlug)
    .limit(5000);

  if (error) {
    stages.push({
      stage: "clean",
      ok: false,
      processed: 0,
      skipped: 0,
      errors: [error.message],
    });
    return {
      citySlug: ctx.citySlug,
      stages,
      startedAt,
      finishedAt: new Date().toISOString(),
    };
  }

  const rows = data ?? [];
  stages.push({
    stage: "clean",
    ok: true,
    processed: rows.length,
    skipped: 0,
    errors: [],
  });

  stages.push(await runNormalizeStage(ctx, rows));
  stages.push({
    stage: "dedup",
    ok: true,
    processed: 0,
    skipped: rows.length,
    errors: [],
    meta: { note: "Dedup owned by provider+external_id unique constraint" },
  });

  if (ctx.allowLlm) {
    stages.push({
      stage: "extract_metadata",
      ok: true,
      processed: 0,
      skipped: rows.length,
      errors: [],
      meta: {
        note: "Use npm run enrich for LLM extraction; not inlined here",
      },
    });
  } else {
    stages.push({
      stage: "extract_metadata",
      ok: true,
      processed: 0,
      skipped: rows.length,
      errors: [],
      meta: { skippedReason: "allowLlm=false" },
    });
  }

  if (ctx.dryRun) {
    stages.push({
      stage: "classify_taxonomy",
      ok: true,
      processed: 0,
      skipped: rows.length,
      errors: [],
      meta: { dryRun: true },
    });
  } else {
    stages.push(await runClassifyTaxonomyStage(ctx));
  }

  stages.push({
    stage: "discover_relations",
    ok: true,
    processed: 0,
    skipped: rows.length,
    errors: [],
    meta: { note: "Relations wired in P5" },
  });

  stages.push(runConfidenceStage({ annotated: rows.length }));

  stages.push({
    stage: "upsert_store",
    ok: true,
    processed: rows.length,
    skipped: 0,
    errors: [],
  });

  stages.push({
    stage: "refresh_indexes",
    ok: true,
    processed: 0,
    skipped: 0,
    errors: [],
    meta: { note: "FTS trigger + embedding refresh are write-path owned" },
  });

  stages.push({
    stage: "refresh_cards",
    ok: true,
    processed: 0,
    skipped: 0,
    errors: [],
    meta: { note: "Use /api/cron/knowledge-cards" },
  });

  return {
    citySlug: ctx.citySlug,
    stages,
    startedAt,
    finishedAt: new Date().toISOString(),
  };
}

export * from "./types";
export * from "./normalize";
export * from "./confidence";
export * from "./classify";
