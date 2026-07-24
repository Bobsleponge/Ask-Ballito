import "server-only";
import type { CityWeatherSnapshot, WeatherHorizon } from "./types";
import {
  deriveOutdoorBias,
  formatWeatherSummary,
  isRainyConditionType,
  upcomingWeekendDateKeys,
  weatherPromptHint,
} from "./derive-bias";

const GOOGLE_CURRENT =
  "https://weather.googleapis.com/v1/currentConditions:lookup";
const GOOGLE_HOURLY =
  "https://weather.googleapis.com/v1/forecast/hours:lookup";
const GOOGLE_DAILY =
  "https://weather.googleapis.com/v1/forecast/days:lookup";

interface GoogleCurrentResponse {
  isDaytime?: boolean;
  weatherCondition?: {
    type?: string;
    description?: { text?: string };
  };
  temperature?: { degrees?: number };
  precipitation?: {
    probability?: { percent?: number; type?: string };
    qpf?: { quantity?: number };
  };
}

interface GoogleHourlyResponse {
  forecastHours?: Array<{
    precipitation?: {
      probability?: { percent?: number };
    };
    weatherCondition?: { type?: string };
  }>;
}

interface GoogleDayForecast {
  displayDate?: { year?: number; month?: number; day?: number };
  daytimeForecast?: {
    weatherCondition?: {
      type?: string;
      description?: { text?: string };
    };
    precipitation?: { probability?: { percent?: number } };
  };
  maxTemperature?: { degrees?: number };
}

interface GoogleDailyResponse {
  forecastDays?: GoogleDayForecast[];
}

export async function fetchGoogleWeather(params: {
  apiKey: string;
  lat: number;
  lng: number;
  timeZone: string;
  horizon?: WeatherHorizon;
  hours?: number;
}): Promise<CityWeatherSnapshot | null> {
  const {
    apiKey,
    lat,
    lng,
    timeZone,
    horizon = "near_term",
    hours = 6,
  } = params;
  const loc = `location.latitude=${lat}&location.longitude=${lng}`;
  const key = `key=${encodeURIComponent(apiKey)}`;

  if (horizon === "weekend") {
    return fetchGoogleWeekend({ apiKey, lat, lng, timeZone, loc, key });
  }

  const [currentRes, hourlyRes] = await Promise.all([
    fetch(`${GOOGLE_CURRENT}?${key}&${loc}`, {
      next: { revalidate: 900 },
    }),
    fetch(`${GOOGLE_HOURLY}?${key}&${loc}&hours=${hours}&pageSize=${hours}`, {
      next: { revalidate: 900 },
    }),
  ]);

  if (!currentRes.ok) {
    return null;
  }

  const current = (await currentRes.json()) as GoogleCurrentResponse;
  let hourly: GoogleHourlyResponse | null = null;
  if (hourlyRes.ok) {
    hourly = (await hourlyRes.json()) as GoogleHourlyResponse;
  }

  const conditionType = current.weatherCondition?.type ?? null;
  const conditionText =
    current.weatherCondition?.description?.text?.trim() ||
    conditionType?.replaceAll("_", " ").toLowerCase() ||
    "Unknown";
  const temperatureC =
    typeof current.temperature?.degrees === "number"
      ? current.temperature.degrees
      : null;

  const currentPrecip =
    typeof current.precipitation?.probability?.percent === "number"
      ? current.precipitation.probability.percent
      : null;
  const qpf = current.precipitation?.qpf?.quantity ?? 0;
  const isRainingNow =
    qpf > 0 ||
    isRainyConditionType(conditionType) ||
    (currentPrecip != null && currentPrecip >= 70);

  const hourPercents = (hourly?.forecastHours ?? [])
    .slice(0, hours)
    .map((h) => h.precipitation?.probability?.percent)
    .filter((p): p is number => typeof p === "number");
  const precipProbabilityNextHours =
    hourPercents.length > 0
      ? Math.round(
          hourPercents.reduce((a, b) => a + b, 0) / hourPercents.length,
        )
      : currentPrecip;

  const outdoorBias = deriveOutdoorBias({
    isRainingNow,
    precipProbabilityNextHours,
    conditionType,
    conditionText,
    isDaytime: current.isDaytime ?? null,
    horizon: "near_term",
  });

  const summary = formatWeatherSummary({
    conditionText,
    temperatureC,
    precipProbabilityNextHours,
  });

  return {
    provider: "google",
    fetchedAt: new Date().toISOString(),
    horizon: "near_term",
    summary,
    conditionText,
    conditionType,
    temperatureC,
    precipProbabilityNextHours,
    isRainingNow,
    isDaytime: current.isDaytime ?? null,
    outdoorBias,
    promptHint: weatherPromptHint({
      summary,
      outdoorBias,
      precipProbabilityNextHours,
      horizon: "near_term",
    }),
  };
}

async function fetchGoogleWeekend(params: {
  apiKey: string;
  lat: number;
  lng: number;
  timeZone: string;
  loc: string;
  key: string;
}): Promise<CityWeatherSnapshot | null> {
  const { timeZone, loc, key } = params;
  const res = await fetch(`${GOOGLE_DAILY}?${key}&${loc}&days=8&pageSize=8`, {
    next: { revalidate: 900 },
  });
  if (!res.ok) return null;

  const data = (await res.json()) as GoogleDailyResponse;
  const { keys, labels } = upcomingWeekendDateKeys(timeZone);
  const days = (data.forecastDays ?? []).filter((d) => {
    const y = d.displayDate?.year;
    const m = d.displayDate?.month;
    const day = d.displayDate?.day;
    if (y == null || m == null || day == null) return false;
    return keys.includes(`${y}-${m}-${day}`);
  });

  if (days.length === 0) return null;

  const percents = days
    .map((d) => d.daytimeForecast?.precipitation?.probability?.percent)
    .filter((p): p is number => typeof p === "number");
  const precipProbabilityNextHours =
    percents.length > 0
      ? Math.round(percents.reduce((a, b) => a + b, 0) / percents.length)
      : null;

  const dayBits = days.map((d, i) => {
    const label = labels[i] ?? "Day";
    const text =
      d.daytimeForecast?.weatherCondition?.description?.text?.trim() ||
      d.daytimeForecast?.weatherCondition?.type?.replaceAll("_", " ") ||
      "unknown";
    const p = d.daytimeForecast?.precipitation?.probability?.percent;
    return p != null ? `${label} ${text} (${p}% rain)` : `${label} ${text}`;
  });

  const conditionType =
    days.find((d) =>
      isRainyConditionType(d.daytimeForecast?.weatherCondition?.type),
    )?.daytimeForecast?.weatherCondition?.type ??
    days[0]?.daytimeForecast?.weatherCondition?.type ??
    null;

  const conditionText = dayBits.join("; ");
  const temps = days
    .map((d) => d.maxTemperature?.degrees)
    .filter((t): t is number => typeof t === "number");
  const temperatureC =
    temps.length > 0
      ? Math.round(temps.reduce((a, b) => a + b, 0) / temps.length)
      : null;

  const outdoorBias = deriveOutdoorBias({
    isRainingNow: false,
    precipProbabilityNextHours,
    conditionType,
    conditionText,
    isDaytime: true,
    horizon: "weekend",
  });

  const summary =
    temperatureC != null
      ? `${conditionText}, ~${temperatureC}°C`
      : conditionText;

  return {
    provider: "google",
    fetchedAt: new Date().toISOString(),
    horizon: "weekend",
    summary,
    conditionText,
    conditionType,
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
