import "server-only";
import type { CityWeatherSnapshot, WeatherHorizon } from "./types";
import {
  deriveOutdoorBias,
  formatWeatherSummary,
  isWmoWet,
  upcomingWeekendDateKeys,
  datePartsInZone,
  weatherPromptHint,
} from "./derive-bias";

const OPEN_METEO = "https://api.open-meteo.com/v1/forecast";

const WMO_LABELS: Record<number, string> = {
  0: "Clear",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Foggy",
  48: "Foggy",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Heavy drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  80: "Rain showers",
  81: "Rain showers",
  82: "Heavy rain showers",
  95: "Thunderstorm",
  96: "Thunderstorm with hail",
  99: "Thunderstorm with hail",
};

interface OpenMeteoResponse {
  current?: {
    temperature_2m?: number;
    precipitation?: number;
    rain?: number;
    weather_code?: number;
    is_day?: number;
  };
  hourly?: {
    time?: string[];
    precipitation_probability?: (number | null)[];
    weather_code?: (number | null)[];
  };
  daily?: {
    time?: string[];
    weather_code?: (number | null)[];
    precipitation_probability_max?: (number | null)[];
    temperature_2m_max?: (number | null)[];
  };
}

export async function fetchOpenMeteoWeather(params: {
  lat: number;
  lng: number;
  timezone: string;
  horizon?: WeatherHorizon;
  hours?: number;
}): Promise<CityWeatherSnapshot | null> {
  const { lat, lng, timezone, horizon = "near_term", hours = 6 } = params;

  if (horizon === "weekend") {
    return fetchOpenMeteoWeekend({ lat, lng, timezone });
  }

  const url = new URL(OPEN_METEO);
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lng));
  url.searchParams.set("timezone", timezone);
  url.searchParams.set(
    "current",
    "temperature_2m,precipitation,rain,weather_code,is_day",
  );
  url.searchParams.set("hourly", "precipitation_probability,weather_code");
  url.searchParams.set("forecast_hours", String(hours));

  const res = await fetch(url.toString(), { next: { revalidate: 900 } });
  if (!res.ok) return null;

  const data = (await res.json()) as OpenMeteoResponse;
  const code = data.current?.weather_code ?? null;
  const conditionText =
    (code != null && WMO_LABELS[code]) ||
    (code != null ? `Code ${code}` : "Unknown");
  const temperatureC =
    typeof data.current?.temperature_2m === "number"
      ? data.current.temperature_2m
      : null;
  const precipNow =
    (data.current?.precipitation ?? 0) > 0 ||
    (data.current?.rain ?? 0) > 0 ||
    isWmoWet(code);

  const probs = (data.hourly?.precipitation_probability ?? [])
    .slice(0, hours)
    .filter((p): p is number => typeof p === "number");
  const precipProbabilityNextHours =
    probs.length > 0
      ? Math.round(probs.reduce((a, b) => a + b, 0) / probs.length)
      : null;

  const isDaytime =
    data.current?.is_day === 1
      ? true
      : data.current?.is_day === 0
        ? false
        : null;

  const outdoorBias = deriveOutdoorBias({
    isRainingNow: precipNow,
    precipProbabilityNextHours,
    wmoCode: code,
    conditionText,
    isDaytime,
    horizon: "near_term",
  });

  const summary = formatWeatherSummary({
    conditionText,
    temperatureC,
    precipProbabilityNextHours,
  });

  return {
    provider: "open_meteo",
    fetchedAt: new Date().toISOString(),
    horizon: "near_term",
    summary,
    conditionText,
    conditionType: code != null ? `WMO_${code}` : null,
    temperatureC,
    precipProbabilityNextHours,
    isRainingNow: precipNow,
    isDaytime,
    outdoorBias,
    promptHint: weatherPromptHint({
      summary,
      outdoorBias,
      precipProbabilityNextHours,
      horizon: "near_term",
    }),
  };
}

async function fetchOpenMeteoWeekend(params: {
  lat: number;
  lng: number;
  timezone: string;
}): Promise<CityWeatherSnapshot | null> {
  const { lat, lng, timezone } = params;
  const url = new URL(OPEN_METEO);
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lng));
  url.searchParams.set("timezone", timezone);
  url.searchParams.set(
    "daily",
    "weather_code,precipitation_probability_max,temperature_2m_max",
  );
  url.searchParams.set("forecast_days", "8");

  const res = await fetch(url.toString(), { next: { revalidate: 900 } });
  if (!res.ok) return null;

  const data = (await res.json()) as OpenMeteoResponse;
  const times = data.daily?.time ?? [];
  const { keys, labels } = upcomingWeekendDateKeys(timezone);

  const idxs: number[] = [];
  for (let i = 0; i < times.length; i++) {
    const raw = times[i];
    if (!raw) continue;
    // daily.time is YYYY-MM-DD — normalize to Y-M-D without zero pad for key match
    const [ys, ms, ds] = raw.split("-").map(Number);
    if (ys == null || ms == null || ds == null) continue;
    const key = `${ys}-${ms}-${ds}`;
    if (keys.includes(key)) idxs.push(i);
  }

  // Fallback: match by calendar keys from zone if string parse missed
  if (idxs.length === 0) {
    for (let i = 0; i < times.length; i++) {
      const raw = times[i];
      if (!raw) continue;
      const d = new Date(`${raw}T12:00:00`);
      const parts = datePartsInZone(d, timezone);
      if (keys.includes(`${parts.year}-${parts.month}-${parts.day}`)) {
        idxs.push(i);
      }
    }
  }

  if (idxs.length === 0) return null;

  const percents = idxs
    .map((i) => data.daily?.precipitation_probability_max?.[i])
    .filter((p): p is number => typeof p === "number");
  const precipProbabilityNextHours =
    percents.length > 0
      ? Math.round(percents.reduce((a, b) => a + b, 0) / percents.length)
      : null;

  const dayBits = idxs.map((i, n) => {
    const label = labels[n] ?? "Day";
    const code = data.daily?.weather_code?.[i] ?? null;
    const text =
      (code != null && WMO_LABELS[code]) ||
      (code != null ? `code ${code}` : "unknown");
    const p = data.daily?.precipitation_probability_max?.[i];
    return p != null ? `${label} ${text} (${p}% rain)` : `${label} ${text}`;
  });

  const wetCode = idxs
    .map((i) => data.daily?.weather_code?.[i] ?? null)
    .find((c) => isWmoWet(c));
  const firstCode = data.daily?.weather_code?.[idxs[0]!] ?? null;

  const temps = idxs
    .map((i) => data.daily?.temperature_2m_max?.[i])
    .filter((t): t is number => typeof t === "number");
  const temperatureC =
    temps.length > 0
      ? Math.round(temps.reduce((a, b) => a + b, 0) / temps.length)
      : null;

  const conditionText = dayBits.join("; ");
  const outdoorBias = deriveOutdoorBias({
    isRainingNow: false,
    precipProbabilityNextHours,
    wmoCode: wetCode ?? firstCode,
    conditionText,
    isDaytime: true,
    horizon: "weekend",
  });

  const summary =
    temperatureC != null
      ? `${conditionText}, ~${temperatureC}°C`
      : conditionText;

  return {
    provider: "open_meteo",
    fetchedAt: new Date().toISOString(),
    horizon: "weekend",
    summary,
    conditionText,
    conditionType:
      wetCode != null
        ? `WMO_${wetCode}`
        : firstCode != null
          ? `WMO_${firstCode}`
          : null,
    temperatureC,
    precipProbabilityNextHours,
    isRainingNow: false,
    isDaytime: true,
    outdoorBias,
    promptHint: weatherPromptHint({
      summary,
      outdoorBias,
      precipProbabilityNextHours,
      horizon: "weekend",
    }),
  };
}
