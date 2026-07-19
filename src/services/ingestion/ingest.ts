import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { embedBatch, toVectorLiteral } from "@/lib/ai/embeddings";
import { getProvider } from "@/services/providers";
import {
  MAX_CITY_BUSINESSES,
  TOP_PER_VERTICAL,
  VERTICALS,
  type Vertical,
} from "@/config/verticals";
import { popularityScore } from "@/lib/business-ranking";
import { buildEmbeddingText as buildEmbeddingTextFromFields } from "@/lib/business-embedding-text";
import {
  computeBusinessQualityScore,
  countAttributes,
} from "@/services/ai/business-quality";
import type { NormalizedBusiness } from "@/lib/schemas/business";
import type { BusinessInsert } from "@/types/database";
import type { City } from "@/config/cities";

/** Builds the canonical text that gets embedded for semantic search. */
export function buildEmbeddingText(b: NormalizedBusiness): string {
  return buildEmbeddingTextFromFields({
    name: b.name,
    category: b.category,
    categories: b.categories,
    description: b.description,
    address: b.address,
    metadata: b.metadata as Record<string, unknown>,
  });
}

function takeTop(businesses: NormalizedBusiness[], n: number): NormalizedBusiness[] {
  return [...businesses]
    .sort((a, b) => popularityScore(b) - popularityScore(a))
    .slice(0, n);
}

function toInsert(b: NormalizedBusiness, embedding: number[]): BusinessInsert {
  const meta = { ...(b.metadata as Record<string, unknown>) };
  const photos = Array.isArray(b.photos) ? b.photos.length : 0;
  meta.qualityScore = computeBusinessQualityScore({
    phone: b.phone,
    website: b.website,
    description: b.description,
    ratingCount: b.ratingCount,
    photoCount: photos,
    hasOpeningHours: Boolean(meta.opening_hours || meta.openingHours),
    attributeCount: countAttributes(meta),
    provider: b.provider,
  });

  return {
    provider: b.provider,
    external_id: b.externalId,
    city_slug: b.citySlug,
    name: b.name,
    category: b.category,
    categories: b.categories,
    description: b.description,
    address: b.address,
    phone: b.phone,
    website: b.website,
    rating: b.rating,
    rating_count: b.ratingCount,
    price_level: b.priceLevel,
    lat: b.lat,
    lng: b.lng,
    photos: b.photos as BusinessInsert["photos"],
    metadata: meta as BusinessInsert["metadata"],
    embedding: toVectorLiteral(embedding),
    embedding_text: buildEmbeddingText(b),
  };
}

function withVertical(b: NormalizedBusiness, verticalSlug: string): NormalizedBusiness {
  const existing = Array.isArray(b.metadata.verticals)
    ? b.metadata.verticals.filter((v): v is string => typeof v === "string")
    : [];
  const verticals = [...new Set([...existing, verticalSlug])];
  return {
    ...b,
    metadata: {
      ...b.metadata,
      verticals,
    },
  };
}

export interface IngestResult {
  fetched: number;
  upserted: number;
  capped: number;
  provider: string;
  city: string;
  byVertical: Record<string, number>;
}

/**
 * When over the city cap, keep the most popular places while preserving at
 * least one slot per vertical that had results (round-robin by popularity).
 */
function applyCityCap(
  byId: Map<string, NormalizedBusiness>,
  verticalOrder: readonly Vertical[],
  maxBusinesses: number,
): Map<string, NormalizedBusiness> {
  if (byId.size <= maxBusinesses) return byId;

  const queues = new Map<string, NormalizedBusiness[]>();
  for (const vertical of verticalOrder) {
    const ranked = [...byId.values()]
      .filter((b) => {
        const verts = Array.isArray(b.metadata.verticals) ? b.metadata.verticals : [];
        return verts.includes(vertical.slug);
      })
      .sort((a, b) => popularityScore(b) - popularityScore(a));
    queues.set(vertical.slug, ranked);
  }

  const kept = new Map<string, NormalizedBusiness>();
  let added = true;
  while (kept.size < maxBusinesses && added) {
    added = false;
    for (const vertical of verticalOrder) {
      if (kept.size >= maxBusinesses) break;
      const queue = queues.get(vertical.slug);
      if (!queue?.length) continue;
      const next = queue.shift()!;
      if (!kept.has(next.externalId)) {
        kept.set(next.externalId, next);
        added = true;
      }
    }
  }

  // Fill remaining slots with overall popularity if round-robin stalled early.
  if (kept.size < maxBusinesses) {
    const leftovers = [...byId.values()]
      .filter((b) => !kept.has(b.externalId))
      .sort((a, b) => popularityScore(b) - popularityScore(a));
    for (const b of leftovers) {
      if (kept.size >= maxBusinesses) break;
      kept.set(b.externalId, b);
    }
  }

  return kept;
}

/**
 * Pulls the top N Google Places results for each industry vertical, embeds
 * them, and upserts into `businesses` with `metadata.verticals` tags.
 * Replaces prior rows for the same city + provider so the directory stays
 * within the configured cap.
 */
export async function ingestForCity(opts: {
  city: City;
  providerName?: string;
  verticals?: readonly Vertical[];
  topPerVertical?: number;
  maxBusinesses?: number;
}): Promise<IngestResult> {
  const {
    city,
    providerName = "google_places",
    verticals = VERTICALS,
    topPerVertical = TOP_PER_VERTICAL,
    maxBusinesses = MAX_CITY_BUSINESSES,
  } = opts;
  const provider = getProvider(providerName);

  if (!provider.isConfigured()) {
    throw new Error(`Provider "${providerName}" is not configured (missing credentials).`);
  }

  const byId = new Map<string, NormalizedBusiness>();
  const byVertical: Record<string, number> = {};

  for (const vertical of verticals) {
    const results = await provider.search({
      city,
      query: vertical.query,
      maxResults: topPerVertical,
    });
    const top = takeTop(results, topPerVertical);
    byVertical[vertical.slug] = top.length;

    for (const result of top) {
      if (!result.externalId) continue;
      const existing = byId.get(result.externalId);
      if (existing) {
        byId.set(result.externalId, withVertical(existing, vertical.slug));
      } else {
        byId.set(result.externalId, withVertical(result, vertical.slug));
      }
    }
  }

  const beforeCap = byId.size;
  const capped = applyCityCap(byId, verticals, maxBusinesses);
  const businesses = [...capped.values()];

  // Recount vertical membership after the cap.
  for (const vertical of verticals) {
    byVertical[vertical.slug] = businesses.filter((b) => {
      const verts = Array.isArray(b.metadata.verticals) ? b.metadata.verticals : [];
      return verts.includes(vertical.slug);
    }).length;
  }

  if (businesses.length === 0) {
    return {
      fetched: 0,
      upserted: 0,
      capped: 0,
      provider: providerName,
      city: city.slug,
      byVertical,
    };
  }

  const embeddings = await embedBatch(businesses.map(buildEmbeddingText));
  const rows = businesses.map((b, i) => toInsert(b, embeddings[i]));

  const admin = createAdminClient();

  // Remove any leftover fake seed rows, then replace prior discovery rows
  // for this city so the cap is hard, not additive.
  const { error: seedWipeError } = await admin
    .from("businesses")
    .delete()
    .eq("city_slug", city.slug)
    .eq("provider", "seed");
  if (seedWipeError) throw new Error(`Seed clear failed: ${seedWipeError.message}`);

  const { error: wipeError } = await admin
    .from("businesses")
    .delete()
    .eq("city_slug", city.slug)
    .eq("provider", providerName);
  if (wipeError) throw new Error(`Clear failed: ${wipeError.message}`);

  const { error, count } = await admin
    .from("businesses")
    .upsert(rows, { onConflict: "provider,external_id", count: "exact" });

  if (error) throw new Error(`Upsert failed: ${error.message}`);

  return {
    fetched: beforeCap,
    upserted: count ?? rows.length,
    capped: beforeCap - businesses.length,
    provider: providerName,
    city: city.slug,
    byVertical,
  };
}
