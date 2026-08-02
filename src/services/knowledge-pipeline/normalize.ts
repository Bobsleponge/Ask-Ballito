import "server-only";
import type { PipelineContext, PipelineStageResult } from "./types";

/** Normalize phones / URLs / whitespace — no LLM. */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d+]/g, "");
  return digits.length >= 7 ? digits : raw.trim() || null;
}

export function normalizeWebsite(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let url = raw.trim();
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  try {
    const u = new URL(url);
    if (!u.hostname.includes(".")) return null;
    return u.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function normalizeName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

export async function runNormalizeStage(
  ctx: PipelineContext,
  rows: Array<{ id: string; name: string; phone: string | null; website: string | null }>,
): Promise<PipelineStageResult> {
  void ctx;
  let processed = 0;
  for (const row of rows) {
    normalizeName(row.name);
    normalizePhone(row.phone);
    normalizeWebsite(row.website);
    processed += 1;
  }
  return {
    stage: "normalize",
    ok: true,
    processed,
    skipped: 0,
    errors: [],
  };
}
