import "server-only";
import { createClient } from "@/lib/supabase/server";
import { VERTICALS, TOP_PER_VERTICAL, type Vertical } from "@/config/verticals";
import { popularityScore } from "@/lib/business-ranking";
import type { BusinessResult, BusinessPhoto } from "@/lib/schemas/business";
import { enrichBusinessResults } from "@/lib/business-portal/enrich-business-results";

export interface VerticalDirectorySection {
  vertical: Vertical;
  businesses: BusinessResult[];
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
  };
}

function verticalsFromMetadata(metadata: unknown): string[] {
  if (!metadata || typeof metadata !== "object") return [];
  const verticals = (metadata as { verticals?: unknown }).verticals;
  if (!Array.isArray(verticals)) return [];
  return verticals.filter((v): v is string => typeof v === "string");
}

/**
 * Loads Google-sourced businesses for a city, grouped into industry verticals
 * (top N by popularity within each vertical).
 */
export async function getVerticalDirectory(
  citySlug: string,
  topPerVertical: number = TOP_PER_VERTICAL,
): Promise<VerticalDirectorySection[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("businesses")
    .select(
      "id, name, category, description, address, phone, website, rating, rating_count, price_level, lat, lng, photos, metadata",
    )
    .eq("city_slug", citySlug)
    .eq("provider", "google_places");

  if (error) throw new Error(`Failed to load directory: ${error.message}`);

  const rows = await enrichBusinessResults((data ?? []).map(rowToResult));

  return VERTICALS.map((vertical) => {
    const businesses = rows
      .filter((b) => verticalsFromMetadata(b.metadata).includes(vertical.slug))
      .sort(
        (a, b) =>
          popularityScore({
            rating: b.rating,
            ratingCount: b.ratingCount,
          }) -
          popularityScore({
            rating: a.rating,
            ratingCount: a.ratingCount,
          }),
      )
      .slice(0, topPerVertical);

    return { vertical, businesses };
  });
}
