export type WeatherOutdoorBias = "favor_outdoor" | "favor_indoor" | "neutral";

export type WeatherHorizon = "near_term" | "weekend";

export interface CityWeatherSnapshot {
  provider: "google" | "open_meteo";
  fetchedAt: string;
  horizon: WeatherHorizon;
  /** Short human summary, e.g. "Light rain, 22°C" or "Weekend: showers Sat, clearer Sun". */
  summary: string;
  conditionText: string;
  conditionType: string | null;
  temperatureC: number | null;
  /** 0–100 chance of precipitation over the planning window. */
  precipProbabilityNextHours: number | null;
  isRainingNow: boolean;
  isDaytime: boolean | null;
  outdoorBias: WeatherOutdoorBias;
  /** Instruction block for LLM system prompts. */
  promptHint: string;
}
