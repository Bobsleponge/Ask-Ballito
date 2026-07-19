import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { embedText, toVectorLiteral } from "@/lib/ai/embeddings";
import { AI_MODEL } from "@/lib/ai/openai";
import { buildEmbeddingText } from "@/lib/business-embedding-text";
import {
  MAX_REVIEWS,
  MAX_REVIEW_SNIPPETS,
  wantsReviews,
} from "@/config/enrichment";
import { getCity, type City } from "@/config/cities";
import { googlePlacesProvider } from "@/services/providers/google-places.provider";
import {
  computeBusinessQualityScore,
  countAttributes,
} from "@/services/ai/business-quality";
import { extractServicesService } from "./extract-services.service";
import type { Json } from "@/types/database";

export interface EnrichOptions {
  citySlug: string;
  force?: boolean;
  /** Only enrich businesses tagged with this vertical slug. */
  vertical?: string;
  limit?: number;
  provider?: string;
}

export interface EnrichResult {
  city: string;
  scanned: number;
  enriched: number;
  skipped: number;
  failed: number;
  withReviews: number;
}

type BusinessRow = {
  id: string;
  provider: string;
  external_id: string | null;
  city_slug: string;
  name: string;
  category: string | null;
  categories: string[];
  description: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  rating: number | null;
  rating_count: number | null;
  price_level: number | null;
  lat: number | null;
  lng: number | null;
  photos: unknown;
  metadata: unknown;
};

function verticalsFrom(metadata: unknown): string[] {
  if (!metadata || typeof metadata !== "object") return [];
  const verticals = (metadata as { verticals?: unknown }).verticals;
  if (!Array.isArray(verticals)) return [];
  return verticals.filter((v): v is string => typeof v === "string");
}

function alreadyEnriched(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== "object") return false;
  const enrichment = (metadata as { enrichment?: { enrichedAt?: unknown } })
    .enrichment;
  return typeof enrichment?.enrichedAt === "string";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Hybrid enrichment: Place Details for every business; reviews only for
 * service-heavy verticals; LLM extracts services/keywords/attributes; re-embed.
 */
export class EnrichBusinessService {
  async enrichCity(opts: EnrichOptions): Promise<EnrichResult> {
    const {
      citySlug,
      force = false,
      vertical,
      limit,
      provider = "google_places",
    } = opts;

    const city = getCity(citySlug);
    if (!city) throw new Error(`Unknown city slug: "${citySlug}"`);
    if (provider !== "google_places") {
      throw new Error(
        `Enrichment only supports real Google Places data (got provider="${provider}").`,
      );
    }
    if (!googlePlacesProvider.isConfigured()) {
      throw new Error("GOOGLE_PLACES_API_KEY is not configured.");
    }

    const admin = createAdminClient();

    // Drop any leftover fake/seed rows before enriching.
    await admin.from("businesses").delete().eq("city_slug", citySlug).eq("provider", "seed");

    let query = admin
      .from("businesses")
      .select(
        "id, provider, external_id, city_slug, name, category, categories, description, address, phone, website, rating, rating_count, price_level, lat, lng, photos, metadata",
      )
      .eq("city_slug", citySlug)
      .eq("provider", "google_places")
      .order("rating_count", { ascending: false, nullsFirst: false });

    const { data, error } = await query;
    if (error) throw new Error(`Failed to load businesses: ${error.message}`);

    let rows = (data ?? []) as BusinessRow[];
    if (vertical) {
      rows = rows.filter((r) => verticalsFrom(r.metadata).includes(vertical));
    }
    if (!force) {
      rows = rows.filter((r) => !alreadyEnriched(r.metadata));
    }
    if (limit != null && limit > 0) {
      rows = rows.slice(0, limit);
    }

    const result: EnrichResult = {
      city: citySlug,
      scanned: rows.length,
      enriched: 0,
      skipped: 0,
      failed: 0,
      withReviews: 0,
    };

    for (const row of rows) {
      try {
        const ok = await this.enrichOne(row, city);
        if (ok.enriched) {
          result.enriched += 1;
          if (ok.withReviews) result.withReviews += 1;
        } else {
          result.skipped += 1;
        }
      } catch (err) {
        result.failed += 1;
        console.error(
          `Enrich failed for ${row.name}:`,
          err instanceof Error ? err.message : err,
        );
      }
      // Gentle pacing for Places + OpenAI.
      await sleep(150);
    }

    return result;
  }

  private async enrichOne(
    row: BusinessRow,
    city: City,
  ): Promise<{ enriched: boolean; withReviews: boolean }> {
    if (row.provider !== "google_places" || !row.external_id) {
      return { enriched: false, withReviews: false };
    }

    const existingMeta =
      row.metadata && typeof row.metadata === "object"
        ? { ...(row.metadata as Record<string, unknown>) }
        : {};
    const verticals = verticalsFrom(existingMeta);
    const includeReviews = wantsReviews(verticals);

    const details = await googlePlacesProvider.getEnrichmentDetails(
      row.external_id,
      city,
      { includeReviews, maxReviews: MAX_REVIEWS },
    );
    if (!details) return { enriched: false, withReviews: false };

    const { business, reviews } = details;
    const reviewTexts = reviews.map((r) => r.text);

    const extracted = await extractServicesService.extract({
      name: business.name || row.name,
      category: business.category ?? row.category,
      types: business.categories?.length
        ? business.categories
        : (row.categories ?? []),
      description: business.description ?? row.description,
      address: business.address ?? row.address,
      verticals,
      reviews: reviewTexts,
    });

    const description =
      extracted.summary?.trim() ||
      business.description ||
      row.description ||
      null;

    const photos = Array.isArray(business.photos) ? business.photos : [];
    const mergedMeta: Record<string, unknown> = {
      ...existingMeta,
      ...(business.metadata as Record<string, unknown>),
      verticals,
      services: extracted.services,
      keywords: extracted.keywords,
      attributes: {
        ...((existingMeta.attributes as object) ?? {}),
        ...extracted.attributes,
      },
      attributesSource: "llm",
      reviewSnippets: reviewTexts
        .map((t) => t.slice(0, 180))
        .slice(0, MAX_REVIEW_SNIPPETS),
      enrichment: {
        enrichedAt: new Date().toISOString(),
        hasReviews: reviewTexts.length > 0,
        reviewCount: reviewTexts.length,
        model: AI_MODEL,
      },
    };

    mergedMeta.qualityScore = computeBusinessQualityScore({
      phone: business.phone ?? row.phone,
      website: business.website ?? row.website,
      description,
      ratingCount: business.ratingCount ?? row.rating_count,
      photoCount: photos.length,
      hasOpeningHours: Boolean(mergedMeta.openingHours),
      attributeCount: countAttributes(mergedMeta),
      provider: row.provider,
    });

    const embeddingText = buildEmbeddingText({
      name: business.name || row.name,
      category: business.category ?? row.category,
      categories: business.categories?.length
        ? business.categories
        : row.categories,
      description,
      address: business.address ?? row.address,
      metadata: mergedMeta,
    });
    const embedding = await embedText(embeddingText);

    const admin = createAdminClient();
    const { error } = await admin
      .from("businesses")
      .update({
        name: business.name || row.name,
        category: business.category ?? row.category,
        categories: business.categories?.length
          ? business.categories
          : row.categories,
        description,
        address: business.address ?? row.address,
        phone: business.phone ?? row.phone,
        website: business.website ?? row.website,
        rating: business.rating ?? row.rating,
        rating_count: business.ratingCount ?? row.rating_count,
        price_level: business.priceLevel ?? row.price_level,
        lat: business.lat ?? row.lat,
        lng: business.lng ?? row.lng,
        photos: (photos.length ? photos : row.photos) as Json,
        metadata: mergedMeta as Json,
        embedding: toVectorLiteral(embedding),
        embedding_text: embeddingText,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    if (error) throw new Error(error.message);

    return { enriched: true, withReviews: reviewTexts.length > 0 };
  }
}

export const enrichBusinessService = new EnrichBusinessService();
