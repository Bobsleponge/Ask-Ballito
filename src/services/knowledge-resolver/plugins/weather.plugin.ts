import "server-only";
import { getCityWeather } from "@/services/weather/weather.service";
import type {
  KnowledgeResolution,
  KnowledgeResolverInput,
  KnowledgeResolverPlugin,
} from "../types";

/** Narrow weather-fact asks — not "rainy day activities". */
const WEATHER_FACT_RE =
  /\b(weather|forecast|will it rain|temperature|how hot|how cold|rain(ing)? today|sunny today)\b/i;

function isWeatherFactAsk(input: KnowledgeResolverInput): boolean {
  if (input.classification.signals.includes("live_weather")) return true;
  if (
    input.classification.queryClass === "LIVE_INFORMATION" &&
    WEATHER_FACT_RE.test(input.message)
  ) {
    return true;
  }
  return WEATHER_FACT_RE.test(input.message);
}

function formatWeatherFact(opts: {
  cityName: string;
  summary: string;
  precipProbabilityNextHours: number | null;
}): string {
  const parts = [`Right now in ${opts.cityName}: ${opts.summary}.`];
  if (
    opts.precipProbabilityNextHours != null &&
    opts.precipProbabilityNextHours >= 40 &&
    !/rain|shower|precip/i.test(opts.summary)
  ) {
    parts.push(
      `Chance of rain about ${Math.round(opts.precipProbabilityNextHours)}%.`,
    );
  }
  parts.push("Ask if you want indoor or outdoor ideas that fit the conditions.");
  return parts.join(" ");
}

export const weatherPlugin: KnowledgeResolverPlugin = {
  id: "weather",
  async resolve(input: KnowledgeResolverInput): Promise<KnowledgeResolution | null> {
    if (!isWeatherFactAsk(input)) return null;

    const snapshot = await getCityWeather(input.city);
    if (!snapshot) return null;

    const text = formatWeatherFact({
      cityName: input.city.name,
      summary: snapshot.summary,
      precipProbabilityNextHours: snapshot.precipProbabilityNextHours,
    });

    return {
      type: "LIVE_DATA",
      answered: true,
      confidence: 0.92,
      reason: "Answered from cached city weather snapshot",
      sources: [`weather:${snapshot.provider}`],
      nextStage: "return",
      expectedCost: "low",
      expectedLatencyMs: 80,
      pluginId: "weather",
      text,
      businesses: [],
      composition: null,
      signals: ["knowledge_resolver:weather"],
    };
  },
};
