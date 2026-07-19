import { z } from "zod";
import { businessAttributesSchema } from "./business-attributes";

export const businessPhotoSchema = z.object({
  // May be an absolute URL or an app-relative proxy path (e.g. /api/photo?...).
  url: z.string().min(1),
  attribution: z.string().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

export const businessEnrichmentMetaSchema = z.object({
  enrichedAt: z.string(),
  hasReviews: z.boolean(),
  reviewCount: z.number().int().nonnegative(),
  model: z.string(),
});

export const businessMetadataSchema = z
  .object({
    primaryType: z.string().nullish(),
    types: z.array(z.string()).nullish(),
    /** Industry vertical slugs from discovery ingest (see config/verticals). */
    verticals: z.array(z.string()).optional(),
    /** Normalized offerings extracted from listing/reviews (e.g. "acrylic nails"). */
    services: z.array(z.string()).optional(),
    /** Search aliases / SEO keywords (e.g. "acrylic", "gel", "balayage"). */
    keywords: z.array(z.string()).optional(),
    /** Short review excerpts kept for debug (not used as primary corpus). */
    reviewSnippets: z.array(z.string()).optional(),
    openingHours: z
      .object({
        weekdayDescriptions: z.array(z.string()).optional(),
        openNow: z.boolean().nullable().optional(),
      })
      .optional(),
    attributes: businessAttributesSchema.optional(),
    attributesSource: z.enum(["manual", "llm", "provider"]).optional(),
    enrichment: businessEnrichmentMetaSchema.optional(),
  })
  .catchall(z.unknown());

/**
 * Normalized business shape that every data provider must produce. Keeping this
 * provider-agnostic lets new providers plug in without touching the ingestion
 * pipeline or schema.
 */
export const normalizedBusinessSchema = z.object({
  provider: z.string(),
  externalId: z.string(),
  citySlug: z.string(),
  name: z.string(),
  category: z.string().nullable(),
  categories: z.array(z.string()).default([]),
  description: z.string().nullable(),
  address: z.string().nullable(),
  phone: z.string().nullable(),
  website: z.string().nullable(),
  rating: z.number().nullable(),
  ratingCount: z.number().int().nullable(),
  priceLevel: z.number().int().min(0).max(4).nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  photos: z.array(businessPhotoSchema).default([]),
  metadata: businessMetadataSchema.default({}),
});

export type NormalizedBusiness = z.infer<typeof normalizedBusinessSchema>;
export type BusinessPhoto = z.infer<typeof businessPhotoSchema>;

/** Business shape returned to the client UI. */
export interface BusinessResult {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  rating: number | null;
  ratingCount: number | null;
  priceLevel: number | null;
  lat: number | null;
  lng: number | null;
  photos: BusinessPhoto[];
  metadata?: Record<string, unknown>;
  similarity?: number;
  /** Deterministic rank score 0–100. */
  score?: number;
}
