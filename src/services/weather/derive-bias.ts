import type { WeatherHorizon, WeatherOutdoorBias } from "./types";

const RAINY_TYPES = new Set([
  "RAIN",
  "LIGHT_RAIN",
  "HEAVY_RAIN",
  "RAIN_SHOWERS",
  "CHANCE_OF_SHOWERS",
  "SCATTERED_SHOWERS",
  "THUNDERSTORM",
  "THUNDERSHOWER",
  "HEAVY_THUNDERSTORM",
  "LIGHT_THUNDERSTORM_RAIN",
  "THUNDERSTORM_RAIN",
  "HAIL",
  "SLEET",
  "SNOW",
  "LIGHT_SNOW",
  "HEAVY_SNOW",
  "SNOW_SHOWERS",
  "RAIN_AND_SNOW",
]);

/** Clear / sunny Google Weather condition types. */
const CLEAR_TYPES = new Set([
  "CLEAR",
  "MOSTLY_CLEAR",
  "SUNNY",
  "MOSTLY_SUNNY",
  "FAIR",
  "CLEAR_WITH_PERIODIC_CLOUDS",
]);

/** WMO weather codes that are wet / stormy (Open-Meteo). */
const WMO_WET = new Set([
  51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95,
  96, 99,
]);

/** WMO clear / mostly clear. */
const WMO_CLEAR = new Set([0, 1]);

export function deriveOutdoorBias(input: {
  isRainingNow: boolean;
  precipProbabilityNextHours: number | null;
  conditionType?: string | null;
  conditionText?: string | null;
  wmoCode?: number | null;
  isDaytime?: boolean | null;
  /** Weekend planning uses slightly softer rain thresholds. */
  horizon?: WeatherHorizon;
}): WeatherOutdoorBias {
  const precip = input.precipProbabilityNextHours;
  const wetType =
    (input.conditionType != null && RAINY_TYPES.has(input.conditionType)) ||
    (input.wmoCode != null && WMO_WET.has(input.wmoCode));
  const clearType =
    (input.conditionType != null && CLEAR_TYPES.has(input.conditionType)) ||
    (input.wmoCode != null && WMO_CLEAR.has(input.wmoCode)) ||
    /\b(sunny|clear|fair)\b/i.test(input.conditionText ?? "");
  const indoorAt = input.horizon === "weekend" ? 45 : 55;
  const outdoorAt = input.horizon === "weekend" ? 30 : 25;
  const daytimeOk = input.isDaytime !== false;

  // Rain / storms → soft indoor priority (never a hard exclude elsewhere).
  if (input.isRainingNow || wetType || (precip != null && precip >= indoorAt)) {
    return "favor_indoor";
  }

  // Sunny / dry → outdoor priority so ranking + sections can steer.
  if (daytimeOk && !wetType) {
    if (clearType && (precip == null || precip < indoorAt)) {
      return "favor_outdoor";
    }
    if (precip != null && precip <= outdoorAt) {
      return "favor_outdoor";
    }
  }

  return "neutral";
}

export function formatWeatherSummary(input: {
  conditionText: string;
  temperatureC: number | null;
  precipProbabilityNextHours: number | null;
}): string {
  const temp =
    input.temperatureC != null
      ? `${Math.round(input.temperatureC)}°C`
      : null;
  const parts = [input.conditionText, temp].filter(Boolean);
  return parts.join(", ") || "Conditions unavailable";
}

export function isWmoWet(code: number | null | undefined): boolean {
  return code != null && WMO_WET.has(code);
}

export function isRainyConditionType(type: string | null | undefined): boolean {
  return type != null && RAINY_TYPES.has(type);
}

/**
 * Instruction block for weather-relevant workflows.
 * Weather prioritises among matches — it must not drop the user's core ask.
 */
export function weatherPromptHint(input: {
  summary: string;
  outdoorBias: WeatherOutdoorBias;
  precipProbabilityNextHours: number | null;
  horizon: WeatherHorizon;
}): string {
  const window =
    input.horizon === "weekend"
      ? "this weekend"
      : "the next few hours";
  const precip =
    input.precipProbabilityNextHours != null
      ? ` (~${input.precipProbabilityNextHours}% rain chance for ${window})`
      : "";

  const lead = `Local weather (${window}): ${input.summary}${precip}.`;
  const priorityRule =
    "PRIORITIZE with weather — never exclude places that fit the ask. Weather only reorders among relevant matches (e.g. sea-view burgers still beat sea-view seafood when the user asked for burgers).";

  if (input.outdoorBias === "favor_indoor") {
    return [
      lead,
      "REQUIRED: open with one short weather clause and lean indoor/covered when it fits the ask.",
      "Prefer malls, covered dining, and rain-friendly spots among matches — beaches only as a backup.",
      priorityRule,
      "Do not lecture.",
    ].join(" ");
  }

  if (input.outdoorBias === "favor_outdoor") {
    return [
      lead,
      "REQUIRED: open with one short weather clause and lean outdoor when it fits the ask.",
      "Prefer parks, adventures, and outdoor family spots among matches — do not lead with beaches (locals already know them; beaches may appear later as an optional section).",
      "For dining asks, al fresco / sea-view is fine when it still fits the food request.",
      priorityRule,
      "Do not lecture.",
    ].join(" ");
  }

  return [
    lead,
    "Mention weather briefly only if it helps the plan; do not invent a strong indoor or outdoor lean.",
    priorityRule,
    "Do not lecture.",
  ].join(" ");
}

/** Upcoming Sat+Sun date keys (YYYY-M-D) in the city timezone. */
export function upcomingWeekendDateKeys(
  timeZone: string,
  now = new Date(),
): { keys: string[]; labels: string[] } {
  const keys: string[] = [];
  const labels: string[] = [];
  // Scan today → +8 days for next Sat and Sun (includes "this weekend" mid-week).
  for (let offset = 0; offset <= 8 && keys.length < 2; offset++) {
    const d = new Date(now.getTime() + offset * 24 * 60 * 60 * 1000);
    const parts = datePartsInZone(d, timeZone);
    const weekday = weekdayInZone(d, timeZone);
    if (weekday === 6 || weekday === 0) {
      const key = `${parts.year}-${parts.month}-${parts.day}`;
      if (!keys.includes(key)) {
        keys.push(key);
        labels.push(weekday === 6 ? "Sat" : "Sun");
      }
    }
  }
  return { keys, labels };
}

export function datePartsInZone(
  date: Date,
  timeZone: string,
): { year: number; month: number; day: number } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
  const parts = fmt.formatToParts(date);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);
  return { year, month, day };
}

/** 0 = Sunday … 6 = Saturday in the given zone. */
function weekdayInZone(date: Date, timeZone: string): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  });
  const w = fmt.format(date);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[w] ?? date.getUTCDay();
}
