import type { City } from "@/config/cities";
import type { NormalizedBusiness } from "@/lib/schemas/business";

export interface ProviderSearchParams {
  city: City;
  /** Free-text query, e.g. "family restaurants". */
  query?: string;
  /** Optional provider-specific category/type filter. */
  category?: string;
  maxResults?: number;
}

export interface ProviderDetailsOptions {
  includeReviews?: boolean;
  maxReviews?: number;
}

/**
 * Common interface every business-data source must implement. New providers
 * (Facebook, directories, manual submissions) plug in by implementing this and
 * registering in providers/index.ts -- no changes to ingestion or schema.
 */
export interface BusinessDataProvider {
  readonly name: string;
  /** Whether the provider is configured (has required credentials). */
  isConfigured(): boolean;
  /** Discover businesses for a city. Must return normalized records. */
  search(params: ProviderSearchParams): Promise<NormalizedBusiness[]>;
  /** Fetch a single business by its provider-specific id. */
  getDetails(
    externalId: string,
    city: City,
    options?: ProviderDetailsOptions,
  ): Promise<NormalizedBusiness | null>;
}
