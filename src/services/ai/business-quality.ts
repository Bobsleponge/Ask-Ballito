/**
 * Deterministic offline business quality / completeness score (0–100).
 * Not an AI score. Used as a ranking signal.
 */

export interface QualitySignals {
  phone?: string | null;
  website?: string | null;
  description?: string | null;
  ratingCount?: number | null;
  photoCount?: number;
  hasOpeningHours?: boolean;
  attributeCount?: number;
  provider?: string | null;
  verified?: boolean;
}

export function computeBusinessQualityScore(signals: QualitySignals): number {
  let score = 0;

  if (signals.phone) score += 10;
  if (signals.website) score += 10;
  if (signals.hasOpeningHours) score += 15;
  if ((signals.photoCount ?? 0) >= 1) score += 10;
  if ((signals.photoCount ?? 0) >= 3) score += 5;
  if (signals.description && signals.description.length > 20) score += 10;

  const rc = signals.ratingCount ?? 0;
  if (rc >= 500) score += 20;
  else if (rc >= 100) score += 14;
  else if (rc >= 20) score += 8;
  else if (rc > 0) score += 4;

  const attrs = Math.min(signals.attributeCount ?? 0, 8);
  score += Math.round((attrs / 8) * 15);

  if (signals.verified || signals.provider === "google_places") {
    score += 5;
  }

  return Math.min(100, Math.max(0, score));
}

export function qualityScoreFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
): number {
  if (!metadata) return 0;
  const q = metadata.qualityScore;
  return typeof q === "number" && Number.isFinite(q) ? q : 0;
}

export function countAttributes(
  metadata: Record<string, unknown> | null | undefined,
): number {
  const attrs = metadata?.attributes;
  if (!attrs || typeof attrs !== "object") return 0;
  return Object.values(attrs as Record<string, unknown>).filter(
    (v) => v === true || (typeof v === "string" && v.length > 0),
  ).length;
}
