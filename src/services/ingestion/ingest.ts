import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { embedBatch, toVectorLiteral } from "@/lib/ai/embeddings";
import { getProvider } from "@/services/providers";
import {
  MAX_CITY_BUSINESSES,
  TOP_PER_VERTICAL,
  VERTICALS,
  topForVertical,
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

function verticalsOf(metadata: unknown): string[] {
  if (!metadata || typeof metadata !== "object") return [];
  const raw = (metadata as { verticals?: unknown }).verticals;
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === "string");
}

function withVertical(b: NormalizedBusiness, verticalSlug: string): NormalizedBusiness {
  const existing = verticalsOf(b.metadata);
  const verticals = [...new Set([...existing, verticalSlug])];
  return {
    ...b,
    metadata: {
      ...b.metadata,
      verticals,
    },
  };
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

export interface IngestResult {
  fetched: number;
  upserted: number;
  capped: number;
  updatedExisting: number;
  insertedNew: number;
  mode: "replace" | "merge";
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
      .filter((b) => verticalsOf(b.metadata).includes(vertical.slug))
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

async function fetchVerticalBatch(opts: {
  city: City;
  providerName: string;
  verticals: readonly Vertical[];
  topPerVertical: number;
}): Promise<{
  byId: Map<string, NormalizedBusiness>;
  byVertical: Record<string, number>;
}> {
  const { city, providerName, verticals, topPerVertical } = opts;
  const provider = getProvider(providerName);

  if (!provider.isConfigured()) {
    throw new Error(
      `Provider "${providerName}" is not configured (missing credentials).`,
    );
  }

  const byId = new Map<string, NormalizedBusiness>();
  const byVertical: Record<string, number> = {};

  for (const vertical of verticals) {
    const limit = topForVertical(vertical, topPerVertical);
    const results = await provider.search({
      city,
      query: vertical.query,
      maxResults: limit,
    });
    const top = takeTop(results, limit);
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

  return { byId, byVertical };
}

/**
 * Full replace ingest: wipe city+provider rows, then write the fetched set.
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

  const { byId, byVertical } = await fetchVerticalBatch({
    city,
    providerName,
    verticals,
    topPerVertical,
  });

  const beforeCap = byId.size;
  const capped = applyCityCap(byId, verticals, maxBusinesses);
  const businesses = [...capped.values()];

  for (const vertical of verticals) {
    byVertical[vertical.slug] = businesses.filter((b) =>
      verticalsOf(b.metadata).includes(vertical.slug),
    ).length;
  }

  if (businesses.length === 0) {
    return {
      fetched: 0,
      upserted: 0,
      capped: 0,
      updatedExisting: 0,
      insertedNew: 0,
      mode: "replace",
      provider: providerName,
      city: city.slug,
      byVertical,
    };
  }

  const embeddings = await embedBatch(businesses.map(buildEmbeddingText));
  const rows = businesses.map((b, i) => toInsert(b, embeddings[i]));

  const admin = createAdminClient();

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
    updatedExisting: 0,
    insertedNew: count ?? rows.length,
    mode: "replace",
    provider: providerName,
    city: city.slug,
    byVertical,
  };
}

type ExistingRow = {
  external_id: string;
  metadata: unknown;
  name: string;
  category: string | null;
  categories: string[] | null;
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
};

/**
 * Merge ingest: fetch only the given verticals, upsert without wiping.
 * Existing rows keep enrichment metadata; vertical tags are unioned.
 * New places are inserted only while under the city cap.
 */
export async function mergeIngestForCity(opts: {
  city: City;
  providerName?: string;
  verticals: readonly Vertical[];
  topPerVertical?: number;
  maxBusinesses?: number;
}): Promise<IngestResult> {
  const {
    city,
    providerName = "google_places",
    verticals,
    topPerVertical = TOP_PER_VERTICAL,
    maxBusinesses = MAX_CITY_BUSINESSES,
  } = opts;

  const { byId, byVertical } = await fetchVerticalBatch({
    city,
    providerName,
    verticals,
    topPerVertical,
  });

  const fetched = byId.size;
  if (fetched === 0) {
    return {
      fetched: 0,
      upserted: 0,
      capped: 0,
      updatedExisting: 0,
      insertedNew: 0,
      mode: "merge",
      provider: providerName,
      city: city.slug,
      byVertical,
    };
  }

  const admin = createAdminClient();
  const externalIds = [...byId.keys()];

  const { data: existingRows, error: existingError } = await admin
    .from("businesses")
    .select(
      "external_id, metadata, name, category, categories, description, address, phone, website, rating, rating_count, price_level, lat, lng, photos",
    )
    .eq("city_slug", city.slug)
    .eq("provider", providerName)
    .in("external_id", externalIds);

  if (existingError) {
    throw new Error(`Failed to load existing businesses: ${existingError.message}`);
  }

  const existingById = new Map<string, ExistingRow>();
  for (const r of existingRows ?? []) {
    if (!r.external_id) continue;
    existingById.set(r.external_id, r as ExistingRow);
  }

  const { count: cityCount, error: countError } = await admin
    .from("businesses")
    .select("id", { count: "exact", head: true })
    .eq("city_slug", city.slug);

  if (countError) {
    throw new Error(`Failed to count city businesses: ${countError.message}`);
  }

  let slotsLeft = Math.max(0, maxBusinesses - (cityCount ?? 0));
  let updatedExisting = 0;
  let insertedNew = 0;
  let capped = 0;

  const toWrite: NormalizedBusiness[] = [];

  for (const [externalId, fetchedBiz] of byId) {
    const existing = existingById.get(externalId);

    if (existing) {
      const mergedVerticals = [
        ...new Set([
          ...verticalsOf(existing.metadata),
          ...verticalsOf(fetchedBiz.metadata),
        ]),
      ];
      const existingMeta =
        existing.metadata && typeof existing.metadata === "object"
          ? (existing.metadata as Record<string, unknown>)
          : {};

      toWrite.push({
        ...fetchedBiz,
        // Prefer fresher Places contact/rating fields; keep enriched metadata.
        name: fetchedBiz.name || existing.name,
        category: fetchedBiz.category ?? existing.category,
        categories: fetchedBiz.categories.length
          ? fetchedBiz.categories
          : (existing.categories ?? []),
        description: fetchedBiz.description ?? existing.description,
        address: fetchedBiz.address ?? existing.address,
        phone: fetchedBiz.phone ?? existing.phone,
        website: fetchedBiz.website ?? existing.website,
        rating: fetchedBiz.rating ?? existing.rating,
        ratingCount: fetchedBiz.ratingCount ?? existing.rating_count,
        priceLevel: fetchedBiz.priceLevel ?? existing.price_level,
        lat: fetchedBiz.lat ?? existing.lat,
        lng: fetchedBiz.lng ?? existing.lng,
        photos:
          fetchedBiz.photos.length > 0
            ? fetchedBiz.photos
            : ((existing.photos as NormalizedBusiness["photos"]) ?? []),
        metadata: {
          ...existingMeta,
          verticals: mergedVerticals,
        },
      });
      updatedExisting++;
      continue;
    }

    if (slotsLeft <= 0) {
      capped++;
      continue;
    }

    toWrite.push(fetchedBiz);
    insertedNew++;
    slotsLeft--;
  }

  for (const vertical of verticals) {
    byVertical[vertical.slug] = toWrite.filter((b) =>
      verticalsOf(b.metadata).includes(vertical.slug),
    ).length;
  }

  if (toWrite.length === 0) {
    return {
      fetched,
      upserted: 0,
      capped,
      updatedExisting,
      insertedNew,
      mode: "merge",
      provider: providerName,
      city: city.slug,
      byVertical,
    };
  }

  const embeddings = await embedBatch(toWrite.map(buildEmbeddingText));
  const rows = toWrite.map((b, i) => toInsert(b, embeddings[i]));

  const { error: seedWipeError } = await admin
    .from("businesses")
    .delete()
    .eq("city_slug", city.slug)
    .eq("provider", "seed");
  if (seedWipeError) throw new Error(`Seed clear failed: ${seedWipeError.message}`);

  const { error, count } = await admin
    .from("businesses")
    .upsert(rows, { onConflict: "provider,external_id", count: "exact" });

  if (error) throw new Error(`Upsert failed: ${error.message}`);

  return {
    fetched,
    upserted: count ?? rows.length,
    capped,
    updatedExisting,
    insertedNew,
    mode: "merge",
    provider: providerName,
    city: city.slug,
    byVertical,
  };
}
