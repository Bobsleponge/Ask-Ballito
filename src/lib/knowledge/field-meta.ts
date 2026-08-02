import { z } from "zod";

/** Who asserted a fact — used for merge policy and confidence defaults. */
export const FactSourceSchema = z.enum([
  "google_places",
  "owner_claim",
  "admin",
  "llm_enrichment",
  "heuristic",
  "user_report",
  "provider",
]);

export type FactSource = z.infer<typeof FactSourceSchema>;

export const VerificationMethodSchema = z.enum([
  "provider",
  "owner_claim",
  "admin",
  "llm_enrichment",
  "heuristic",
  "user_report",
]);

export type VerificationMethod = z.infer<typeof VerificationMethodSchema>;

export const FieldProvenanceSchema = z.object({
  confidence: z.number().min(0).max(1),
  source: FactSourceSchema,
  verified_at: z.string(),
  method: VerificationMethodSchema,
});

export type FieldProvenance = z.infer<typeof FieldProvenanceSchema>;

export type FieldMetaMap = Record<string, FieldProvenance>;

/** Default confidence by source (deterministic policy). */
export const SOURCE_CONFIDENCE: Record<FactSource, number> = {
  owner_claim: 0.95,
  admin: 0.95,
  google_places: 0.8,
  provider: 0.8,
  llm_enrichment: 0.55,
  heuristic: 0.5,
  user_report: 0.45,
};

/** Merge winners: higher rank wins on conflict. */
export const SOURCE_PRIORITY: Record<FactSource, number> = {
  owner_claim: 100,
  admin: 95,
  google_places: 50,
  provider: 50,
  llm_enrichment: 30,
  heuristic: 20,
  user_report: 25,
};

export function provenance(
  source: FactSource,
  overrides?: Partial<FieldProvenance>,
): FieldProvenance {
  return {
    confidence: SOURCE_CONFIDENCE[source],
    source,
    verified_at: new Date().toISOString(),
    method: source === "google_places" ? "provider" : source,
    ...overrides,
  };
}

/** Whether incoming source may overwrite an existing field. */
export function canOverwrite(
  existing: FieldProvenance | undefined,
  incoming: FactSource,
): boolean {
  if (!existing) return true;
  return SOURCE_PRIORITY[incoming] >= SOURCE_PRIORITY[existing.source];
}

export function setFieldMeta(
  meta: FieldMetaMap,
  field: string,
  source: FactSource,
  overrides?: Partial<FieldProvenance>,
): FieldMetaMap {
  const next = provenance(source, overrides);
  if (!canOverwrite(meta[field], source)) return meta;
  return { ...meta, [field]: next };
}

export function parseFieldMeta(raw: unknown): FieldMetaMap {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: FieldMetaMap = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const parsed = FieldProvenanceSchema.safeParse(value);
    if (parsed.success) out[key] = parsed.data;
  }
  return out;
}

export function minConfidence(
  meta: FieldMetaMap,
  field: string,
  floor: number,
): boolean {
  const entry = meta[field];
  if (!entry) return false;
  return entry.confidence >= floor;
}
