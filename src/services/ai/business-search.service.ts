import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { embedText, toVectorLiteral } from "@/lib/ai/embeddings";
import type { City } from "@/config/cities";
import type { BusinessResult, BusinessPhoto } from "@/lib/schemas/business";

export interface BusinessSearchParams {
  city: City;
  query: string;
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
      city,
      query,
      limit = 18,
      similarityThreshold = 0.15,
    } = params;

    if (!query.trim()) return [];

    const embedding = await embedText(query);
    const admin = createAdminClient();

    const { data, error } = await admin.rpc("match_businesses", {
      p_city_slug: city.slug,
      query_embedding: toVectorLiteral(embedding),
      match_count: limit,
      similarity_threshold: similarityThreshold,
      p_category: null,
    });

    if (error) throw new Error(`match_businesses failed: ${error.message}`);

    // Defense in depth: never surface fake/seed rows even if RPC is stale.
    return (data ?? [])
      .filter((row) => {
        const meta = row.metadata as Record<string, unknown> | null;
        return meta?.seeded !== true;
      })
      .map(rowToResult);
  }

  /**
   * Run multiple semantic queries in parallel and dedupe by business id,
   * keeping the highest similarity for each.
   */
  async searchMany(params: {
    city: City;
    queries: string[];
    limitPerQuery?: number;
    similarityThreshold?: number;
  }): Promise<BusinessResult[]> {
    const {
      city,
      queries,
      limitPerQuery = 12,
      similarityThreshold = 0.15,
    } = params;

    const uniqueQueries = [
      ...new Set(queries.map((q) => q.trim()).filter(Boolean)),
    ];
    if (uniqueQueries.length === 0) return [];

    const batches = await Promise.all(
      uniqueQueries.map((query) =>
        this.search({
          city,
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
}

export const businessSearchService = new BusinessSearchService();
