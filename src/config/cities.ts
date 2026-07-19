/**
 * City registry. City is treated as DATA, not code: adding a new region is a
 * matter of appending an entry here (and ingesting its businesses) with zero
 * architectural changes. Routes live under /[city].
 */

export interface CityBounds {
  /** Southwest corner. */
  sw: { lat: number; lng: number };
  /** Northeast corner. */
  ne: { lat: number; lng: number };
}

export interface City {
  /** URL slug, e.g. "ballito". */
  slug: string;
  /** Display name, e.g. "Ballito". */
  name: string;
  /** Region / province for context in prompts and UI. */
  region: string;
  country: string;
  timezone: string;
  /** Map + search center. */
  center: { lat: number; lng: number };
  /** Default discovery radius in metres for provider searches. */
  defaultRadiusMeters: number;
  /** Bounding box used to constrain ingestion and search. */
  bounds: CityBounds;
  /** Whether the city is live and selectable in the UI. */
  enabled: boolean;
}

export const CITIES: readonly City[] = [
  {
    slug: "ballito",
    name: "Ballito",
    region: "KwaZulu-Natal",
    country: "South Africa",
    timezone: "Africa/Johannesburg",
    center: { lat: -29.5387, lng: 31.2143 },
    defaultRadiusMeters: 12000,
    bounds: {
      sw: { lat: -29.62, lng: 31.13 },
      ne: { lat: -29.45, lng: 31.3 },
    },
    enabled: true,
  },
  {
    slug: "umhlanga",
    name: "Umhlanga",
    region: "KwaZulu-Natal",
    country: "South Africa",
    timezone: "Africa/Johannesburg",
    center: { lat: -29.7273, lng: 31.0855 },
    defaultRadiusMeters: 10000,
    bounds: {
      sw: { lat: -29.78, lng: 31.02 },
      ne: { lat: -29.68, lng: 31.12 },
    },
    enabled: false,
  },
  {
    slug: "durban",
    name: "Durban",
    region: "KwaZulu-Natal",
    country: "South Africa",
    timezone: "Africa/Johannesburg",
    center: { lat: -29.8587, lng: 31.0218 },
    defaultRadiusMeters: 20000,
    bounds: {
      sw: { lat: -29.95, lng: 30.9 },
      ne: { lat: -29.75, lng: 31.1 },
    },
    enabled: false,
  },
  {
    slug: "cape-town",
    name: "Cape Town",
    region: "Western Cape",
    country: "South Africa",
    timezone: "Africa/Johannesburg",
    center: { lat: -33.9249, lng: 18.4241 },
    defaultRadiusMeters: 25000,
    bounds: {
      sw: { lat: -34.1, lng: 18.3 },
      ne: { lat: -33.8, lng: 18.7 },
    },
    enabled: false,
  },
  {
    slug: "johannesburg",
    name: "Johannesburg",
    region: "Gauteng",
    country: "South Africa",
    timezone: "Africa/Johannesburg",
    center: { lat: -26.2041, lng: 28.0473 },
    defaultRadiusMeters: 30000,
    bounds: {
      sw: { lat: -26.35, lng: 27.9 },
      ne: { lat: -26.05, lng: 28.2 },
    },
    enabled: false,
  },
] as const;

export const DEFAULT_CITY_SLUG = "ballito";

export function getCity(slug: string): City | undefined {
  return CITIES.find((c) => c.slug === slug);
}

export function getEnabledCities(): City[] {
  return CITIES.filter((c) => c.enabled);
}

export function isValidCitySlug(slug: string): boolean {
  return CITIES.some((c) => c.slug === slug);
}
