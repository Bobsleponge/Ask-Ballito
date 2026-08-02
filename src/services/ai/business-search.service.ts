import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { embedText, toVectorLiteral } from "@/lib/ai/embeddings";
import { intelligenceFlags } from "@/config/intelligence-flags";
import type { City } from "@/config/cities";
import type { BusinessResult, BusinessPhoto } from "@/lib/schemas/business";
import { enrichBusinessResults } from "@/lib/business-portal/enrich-business-results";

export interface BusinessSearchParams {
  query: string;
  /**
   * City slug filter. Required for Phase 1 callers.
   * Omit in a future release to enable cross-city search (requires RPC support).
   */
  citySlug?: string;
  /** @deprecated Prefer citySlug. Kept for call-site compatibility during transition. */
  city?: City;
  limit?: number;
  similarityThreshold?: number;
  /** Optional category exact match (SQL filter). */
  category?: string | null;
  /** Optional geo filter. */
  lat?: number | null;
  lng?: number | null;
  radiusMeters?: number | null;
  minRating?: number | null;
  minRatingCount?: number | null;
  verifiedOnly?: boolean;
}

function rowToResult(row: {
  id: string;
  name: string;
  category: string | null;
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
  similarity: number;
  fused_score?: number;
}): BusinessResult {
  const fused = row.fused_score;
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description,
    address: row.address,
    phone: row.phone,
    website: row.website,
    rating: row.rating,
    ratingCount: row.rating_count,
    priceLevel: row.price_level,
    lat: row.lat,
    lng: row.lng,
    photos: (row.photos as unknown as BusinessPhoto[]) ?? [],
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    // Prefer fused hybrid score when present so ranking sees FTS+vector signal.
    similarity:
      typeof fused === "number" && fused > 0
        ? Math.min(1, fused * 8)
        : (row.similarity ?? 0),
  };
}

/**
 * Hybrid business search (FTS + pgvector) when HYBRID_SEARCH is enabled;
 * falls back to vector-only + ILIKE lexical merge.
 */
export class BusinessSearchService {
  async search(params: BusinessSearchParams): Promise<BusinessResult[]> {
    const {
      query,
      limit = 30,
      similarityThreshold = 0.15,
      category = null,
      lat = null,
      lng = null,
      radiusMeters = null,
      minRating = null,
      minRatingCount = null,
      verifiedOnly = false,
    } = params;

    const citySlug = params.citySlug ?? params.city?.slug;

    if (!query.trim()) return [];

    if (!citySlug) {
      throw new Error(
        "Cross-city search is not enabled yet; pass citySlug (or city).",
      );
    }

    const embedding = await embedText(query);
    const admin = createAdminClient();

    if (intelligenceFlags.hybridSearch()) {
      const { data, error } = await admin.rpc("hybrid_match_businesses", {
        p_city_slug: citySlug,
        query_embedding: toVectorLiteral(embedding),
        query_text: query,
        match_count: limit,
        similarity_threshold: similarityThreshold,
        p_category: category,
        p_lat: lat,
        p_lng: lng,
        p_radius_meters: radiusMeters,
        p_min_rating: minRating,
        p_min_rating_count: minRatingCount,
        p_verified_only: verifiedOnly,
      });

      if (!error && data) {
        const results = data
          .filter((row) => {
            const meta = row.metadata as Record<string, unknown> | null;
            return meta?.seeded !== true;
          })
          .map(rowToResult);
        if (results.length > 0) {
          return enrichBusinessResults(results.slice(0, limit));
        }
        // Fall through to vector path if hybrid returns empty (e.g. pre-migration).
      }
    }

    const { data, error } = await admin.rpc("match_businesses", {
      p_city_slug: citySlug,
      query_embedding: toVectorLiteral(embedding),
      match_count: limit,
      similarity_threshold: similarityThreshold,
      p_category: category,
    });

    if (error) throw new Error(`match_businesses failed: ${error.message}`);

    let results = (data ?? [])
      .filter((row) => {
        const meta = row.metadata as Record<string, unknown> | null;
        return meta?.seeded !== true;
      })
      .map(rowToResult);

    const topSim = results[0]?.similarity ?? 0;
    const weakVector =
      results.length < Math.min(5, limit) || topSim < similarityThreshold + 0.08;

    if (weakVector) {
      const lexical = await this.lexicalSearch({
        query,
        citySlug,
        limit: Math.min(limit, 12),
      });
      const byId = new Map(results.map((b) => [b.id, b]));
      for (const b of lexical) {
        const existing = byId.get(b.id);
        if (!existing || (b.similarity ?? 0) > (existing.similarity ?? 0)) {
          byId.set(b.id, b);
        }
      }
      results = [...byId.values()].sort(
        (a, b) => (b.similarity ?? 0) - (a.similarity ?? 0),
      );
    }

    return enrichBusinessResults(results.slice(0, limit));
  }

  /**
   * Lexical fallback when vector recall is thin — name/category/description ILIKE.
   */
  private async lexicalSearch(params: {
    query: string;
    citySlug: string;
    limit: number;
  }): Promise<BusinessResult[]> {
    const needle = params.query
      .trim()
      .slice(0, 80)
      .replace(/[^a-zA-Z0-9\s'-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (needle.length < 2) return [];

    const admin = createAdminClient();
    const pattern = `%${needle}%`;
    const { data, error } = await admin
      .from("businesses")
      .select(
        "id, name, category, description, address, phone, website, rating, rating_count, price_level, lat, lng, photos, metadata",
      )
      .eq("city_slug", params.citySlug)
      .or(
        `name.ilike."${pattern}",category.ilike."${pattern}",description.ilike."${pattern}"`,
      )
      .limit(params.limit);

    if (error || !data) return [];

    return data
      .filter((row) => {
        const meta = row.metadata as Record<string, unknown> | null;
        return meta?.seeded !== true;
      })
      .map((row) =>
        rowToResult({
          ...row,
          similarity: 0.22,
        }),
      );
  }

  /**
   * Run multiple semantic queries in parallel and dedupe by business id,
   * keeping the highest similarity for each.
   */
  async searchMany(params: {
    query?: never;
    queries: string[];
    citySlug?: string;
    city?: City;
    limitPerQuery?: number;
    similarityThreshold?: number;
    category?: string | null;
    lat?: number | null;
    lng?: number | null;
    radiusMeters?: number | null;
  }): Promise<BusinessResult[]> {
    const {
      queries,
      limitPerQuery = 12,
      similarityThreshold = 0.15,
    } = params;

    const citySlug = params.citySlug ?? params.city?.slug;

    const uniqueQueries = [
      ...new Set(queries.map((q) => q.trim()).filter(Boolean)),
    ];
    if (uniqueQueries.length === 0) return [];

    const batches = await Promise.all(
      uniqueQueries.map((query) =>
        this.search({
          citySlug,
          city: params.city,
          query,
          limit: limitPerQuery,
          similarityThreshold,
          category: params.category,
          lat: params.lat,
          lng: params.lng,
          radiusMeters: params.radiusMeters,
        }),
      ),
    );

    const byId = new Map<string, BusinessResult>();
    for (const batch of batches) {
      for (const b of batch) {
        const existing = byId.get(b.id);
        if (!existing || (b.similarity ?? 0) > (existing.similarity ?? 0)) {
          byId.set(b.id, b);
        }
      }
    }

    return [...byId.values()];
  }

  /**
   * Load a single business by id (city-scoped) for detail deep links.
   */
  async getById(params: {
    id: string;
    citySlug: string;
  }): Promise<BusinessResult | null> {
    const rows = await this.getByIds({
      ids: [params.id],
      citySlug: params.citySlug,
    });
    return rows[0] ?? null;
  }

  /**
   * Load businesses by id (city-scoped), preserving requested order.
   * Used by knowledge-card fast path.
   */
  async getByIds(params: {
    ids: string[];
    citySlug: string;
  }): Promise<BusinessResult[]> {
    const ids = [...new Set(params.ids.filter(Boolean))];
    if (ids.length === 0) return [];

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("businesses")
      .select(
        "id, name, category, description, address, phone, website, rating, rating_count, price_level, lat, lng, photos, metadata",
      )
      .in("id", ids)
      .eq("city_slug", params.citySlug);

    if (error) throw new Error(`Failed to load businesses: ${error.message}`);

    const byId = new Map<string, BusinessResult>();
    for (const row of data ?? []) {
      const meta = row.metadata as Record<string, unknown> | null;
      if (meta?.seeded === true) continue;
      byId.set(row.id, {
        id: row.id,
        name: row.name,
        category: row.category,
        description: row.description,
        address: row.address,
        phone: row.phone,
        website: row.website,
        rating: row.rating,
        ratingCount: row.rating_count,
        priceLevel: row.price_level,
        lat: row.lat,
        lng: row.lng,
        photos: (row.photos as unknown as BusinessPhoto[]) ?? [],
        metadata: (row.metadata as Record<string, unknown>) ?? {},
        similarity: 0.85,
      });
    }

    const ordered = ids
      .map((id) => byId.get(id))
      .filter((b): b is BusinessResult => Boolean(b));

    return enrichBusinessResults(ordered);
  }
}

export const businessSearchService = new BusinessSearchService();
