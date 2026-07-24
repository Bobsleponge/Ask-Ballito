import "server-only";
import { env } from "@/lib/env";
import type { City } from "@/config/cities";
import type { CityWeatherSnapshot, WeatherHorizon } from "./types";
import { fetchGoogleWeather } from "./google-weather.provider";
import { fetchOpenMeteoWeather } from "./open-meteo.provider";

const cache = new Map<string, { expires: number; value: CityWeatherSnapshot }>();
const TTL_MS = 15 * 60 * 1000;

function weatherApiKey(): string | undefined {
  return env.GOOGLE_WEATHER_API_KEY ?? env.GOOGLE_PLACES_API_KEY;
}

/**
 * Forecast for a city center.
 * Prefers Google Weather; falls back to Open-Meteo.
 * Use horizon "weekend" for Sat/Sun daily outlook (e.g. "fun this weekend").
 */
export async function getCityWeather(
  city: City,
  opts?: { horizon?: WeatherHorizon },
): Promise<CityWeatherSnapshot | null> {
  const horizon = opts?.horizon ?? "near_term";
  const cacheKey = `${city.slug}:${horizon}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return cached.value;
  }

  const key = weatherApiKey();
  let snapshot: CityWeatherSnapshot | null = null;

  if (key) {
    try {
      snapshot = await fetchGoogleWeather({
        apiKey: key,
        lat: city.center.lat,
        lng: city.center.lng,
        timeZone: city.timezone,
        horizon,
      });
    } catch {
      snapshot = null;
    }
  }

  if (!snapshot) {
    try {
      snapshot = await fetchOpenMeteoWeather({
        lat: city.center.lat,
        lng: city.center.lng,
        timezone: city.timezone,
        horizon,
      });
    } catch {
      snapshot = null;
    }
  }

  if (snapshot) {
    cache.set(cacheKey, { expires: Date.now() + TTL_MS, value: snapshot });
  }
  return snapshot;
}

export type { CityWeatherSnapshot, WeatherHorizon } from "./types";
