import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { embedText, toVectorLiteral } from "@/lib/ai/embeddings";
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
}): BusinessResult {
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
    similarity: row.similarity ?? 0,
  };
}

/**
 * Semantic business search via pgvector. Ranking is handled by RankingEngine.
 */
export class BusinessSearchService {
  async search(params: BusinessSearchParams): Promise<BusinessResult[]> {
    const {
      query,
      limit = 30,
      similarityThreshold = 0.15,
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

    const { data, error } = await admin.rpc("match_businesses", {
      p_city_slug: citySlug,
      query_embedding: toVectorLiteral(embedding),
      match_count: limit,
      similarity_threshold: similarityThreshold,
      p_category: null,
    });

    if (error) throw new Error(`match_businesses failed: ${error.message}`);

    // Defense in depth: never surface fake/seed rows even if RPC is stale.
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
          // Lexical hits sit just above threshold so ranker can still re-order.
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
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("businesses")
      .select(
        "id, name, category, description, address, phone, website, rating, rating_count, price_level, lat, lng, photos, metadata",
      )
      .eq("id", params.id)
      .eq("city_slug", params.citySlug)
      .maybeSingle();

    if (error) throw new Error(`Failed to load business: ${error.message}`);
    if (!data) return null;

    const meta = data.metadata as Record<string, unknown> | null;
    if (meta?.seeded === true) return null;

    const [enriched] = await enrichBusinessResults([
      {
        id: data.id,
        name: data.name,
        category: data.category,
        description: data.description,
        address: data.address,
        phone: data.phone,
        website: data.website,
        rating: data.rating,
        ratingCount: data.rating_count,
        priceLevel: data.price_level,
        lat: data.lat,
        lng: data.lng,
        photos: (data.photos as unknown as BusinessPhoto[]) ?? [],
        metadata: (data.metadata as Record<string, unknown>) ?? {},
      },
    ]);

    return enriched ?? null;
  }
}

export const businessSearchService = new BusinessSearchService();
