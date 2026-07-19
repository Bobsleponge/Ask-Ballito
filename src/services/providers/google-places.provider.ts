import "server-only";
import { env } from "@/lib/env";
import { normalizedBusinessSchema, type NormalizedBusiness } from "@/lib/schemas/business";
import type { City } from "@/config/cities";
import type { BusinessDataProvider, ProviderSearchParams } from "./types";

const PLACES_BASE = "https://places.googleapis.com/v1";

const SEARCH_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.types",
  "places.primaryType",
  "places.primaryTypeDisplayName",
  "places.rating",
  "places.userRatingCount",
  "places.priceLevel",
  "places.websiteUri",
  "places.internationalPhoneNumber",
  "places.editorialSummary",
  "places.photos",
].join(",");

const DETAILS_BASE_FIELDS = [
  "id",
  "displayName",
  "formattedAddress",
  "location",
  "types",
  "primaryType",
  "primaryTypeDisplayName",
  "rating",
  "userRatingCount",
  "priceLevel",
  "websiteUri",
  "internationalPhoneNumber",
  "editorialSummary",
  "generativeSummary",
  "regularOpeningHours",
  "photos",
];

const REVIEW_FIELDS = ["reviews"];

const PRICE_LEVEL_MAP: Record<string, number> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

interface GooglePlaceReview {
  text?: { text?: string };
  rating?: number;
}

interface GooglePlace {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  types?: string[];
  primaryType?: string;
  primaryTypeDisplayName?: { text?: string };
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  websiteUri?: string;
  internationalPhoneNumber?: string;
  editorialSummary?: { text?: string };
  generativeSummary?: { overview?: { text?: string } };
  regularOpeningHours?: {
    weekdayDescriptions?: string[];
    openNow?: boolean;
  };
  photos?: { name: string; widthPx?: number; heightPx?: number }[];
  reviews?: GooglePlaceReview[];
}

export interface PlaceReviewSnippet {
  text: string;
  rating?: number;
}

export interface PlaceEnrichmentDetails {
  business: NormalizedBusiness;
  reviews: PlaceReviewSnippet[];
}

export interface GetDetailsOptions {
  includeReviews?: boolean;
  maxReviews?: number;
}

/**
 * Live provider backed by the Google Places API (New). Returns normalized,
 * provider-agnostic business records.
 */
export class GooglePlacesProvider implements BusinessDataProvider {
  readonly name = "google_places";

  isConfigured(): boolean {
    return Boolean(env.GOOGLE_PLACES_API_KEY);
  }

  private apiKey(): string {
    if (!env.GOOGLE_PLACES_API_KEY) {
      throw new Error("GOOGLE_PLACES_API_KEY is not configured.");
    }
    return env.GOOGLE_PLACES_API_KEY;
  }

  async search(params: ProviderSearchParams): Promise<NormalizedBusiness[]> {
    const { city, query = "things to do", maxResults = 20 } = params;

    const res = await fetch(`${PLACES_BASE}/places:searchText`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": this.apiKey(),
        "X-Goog-FieldMask": SEARCH_FIELD_MASK,
      },
      body: JSON.stringify({
        textQuery: `${query} in ${city.name}, ${city.region}`,
        maxResultCount: Math.min(maxResults, 20),
        rankPreference: "RELEVANCE",
        locationBias: {
          circle: {
            center: {
              latitude: city.center.lat,
              longitude: city.center.lng,
            },
            radius: city.defaultRadiusMeters,
          },
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Google Places searchText failed (${res.status}): ${body}`);
    }

    const json = (await res.json()) as { places?: GooglePlace[] };
    return (json.places ?? []).map((p) => this.normalize(p, city));
  }

  async getDetails(
    externalId: string,
    city: City,
    options: GetDetailsOptions = {},
  ): Promise<NormalizedBusiness | null> {
    const enriched = await this.getEnrichmentDetails(externalId, city, options);
    return enriched?.business ?? null;
  }

  /**
   * Place Details for enrichment. Optionally includes review text for
   * service-heavy verticals (not stored long-term on the business row).
   */
  async getEnrichmentDetails(
    externalId: string,
    city: City,
    options: GetDetailsOptions = {},
  ): Promise<PlaceEnrichmentDetails | null> {
    const { includeReviews = false, maxReviews = 5 } = options;
    const fields = includeReviews
      ? [...DETAILS_BASE_FIELDS, ...REVIEW_FIELDS]
      : DETAILS_BASE_FIELDS;

    const res = await fetch(`${PLACES_BASE}/places/${externalId}`, {
      headers: {
        "X-Goog-Api-Key": this.apiKey(),
        "X-Goog-FieldMask": fields.join(","),
      },
    });

    if (res.status === 404) return null;
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Google Places details failed (${res.status}): ${body}`);
    }

    const place = (await res.json()) as GooglePlace;
    const business = this.normalize(place, city);
    const reviews = includeReviews
      ? (place.reviews ?? [])
          .map((r) => ({
            text: r.text?.text?.trim() ?? "",
            rating: r.rating,
          }))
          .filter((r) => r.text.length > 0)
          .slice(0, maxReviews)
      : [];

    return { business, reviews };
  }

  private normalize(place: GooglePlace, city: City): NormalizedBusiness {
    const category =
      place.primaryTypeDisplayName?.text ??
      place.primaryType ??
      place.types?.[0] ??
      null;

    const description =
      place.editorialSummary?.text ??
      place.generativeSummary?.overview?.text ??
      (category ? `${category} in ${city.name}.` : null);

    const photos = (place.photos ?? []).slice(0, 3).map((photo) => ({
      // Proxied through our own route so the API key is never exposed.
      url: `/api/photo?name=${encodeURIComponent(photo.name)}`,
      width: photo.widthPx,
      height: photo.heightPx,
    }));

    const openingHours = place.regularOpeningHours
      ? {
          weekdayDescriptions: place.regularOpeningHours.weekdayDescriptions ?? [],
          openNow: place.regularOpeningHours.openNow ?? null,
        }
      : undefined;

    return normalizedBusinessSchema.parse({
      provider: this.name,
      externalId: place.id,
      citySlug: city.slug,
      name: place.displayName?.text ?? "Unknown",
      category,
      categories: place.types ?? [],
      description,
      address: place.formattedAddress ?? null,
      phone: place.internationalPhoneNumber ?? null,
      website: place.websiteUri ?? null,
      rating: place.rating ?? null,
      ratingCount: place.userRatingCount ?? null,
      priceLevel:
        place.priceLevel != null ? PRICE_LEVEL_MAP[place.priceLevel] ?? null : null,
      lat: place.location?.latitude ?? null,
      lng: place.location?.longitude ?? null,
      photos,
      metadata: {
        primaryType: place.primaryType ?? null,
        types: place.types ?? [],
        ...(openingHours ? { openingHours } : {}),
      },
    });
  }
}

export const googlePlacesProvider = new GooglePlacesProvider();
