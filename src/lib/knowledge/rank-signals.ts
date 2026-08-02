/**
 * Helpers for open-now / freshness / verified signals used by Ranking Engine.
 * Search must not decide order — these are score components only.
 */

import { extractAttributes } from "@/lib/schemas/business-attributes";
import { parseFieldMeta } from "@/lib/knowledge/field-meta";
import type { BusinessResult } from "@/lib/schemas/business";

/** Soft 0–1: listing advertises open-now / after-hours / 24h. */
export function openNowSignal(business: BusinessResult): number {
  const meta = business.metadata ?? {};
  const hours = meta.openingHours as
    | { openNow?: boolean | null }
    | undefined;
  if (hours?.openNow === true) return 1;
  const attrs = extractAttributes(meta);
  if (attrs.open24Hours === true) return 1;
  if (attrs.afterHours === true || attrs.emergencyCallOut === true) return 0.85;
  if (attrs.lateNight === true) return 0.7;
  return 0;
}

/** Soft 0–1: enrichment / update freshness (90-day half-life-ish). */
export function freshnessSignal(business: BusinessResult): number {
  const meta = business.metadata ?? {};
  const enrichedAt =
    typeof (meta.enrichment as { enrichedAt?: string } | undefined)
      ?.enrichedAt === "string"
      ? (meta.enrichment as { enrichedAt: string }).enrichedAt
      : null;
  if (!enrichedAt) return 0.3;
  const ageMs = Date.now() - Date.parse(enrichedAt);
  if (!Number.isFinite(ageMs) || ageMs < 0) return 0.3;
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  return Math.max(0, Math.min(1, 1 - ageDays / 180));
}

/** Soft 0–1: verified / claimed / high-confidence phone. */
export function verifiedSignal(business: BusinessResult): number {
  const meta = business.metadata ?? {};
  if (meta.portalClaimed === true && meta.ownerProfileComplete === true) {
    return 1;
  }
  if (meta.portalClaimed === true) return 0.75;
  const fieldMeta = parseFieldMeta(meta.field_meta ?? meta.fieldMeta);
  const phone = fieldMeta.phone;
  if (phone && phone.source === "owner_claim" && phone.confidence >= 0.9) {
    return 0.8;
  }
  return 0;
}
