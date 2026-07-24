import type { PlannerPlan } from "@/services/planner/types";
import type { CityWeatherSnapshot } from "./types";
import { isWeatherRelevantWorkflow } from "./weather-relevance";

/**
 * Soft-bias ranking + composition from weather.
 * Prioritises outdoor/indoor among matches — never hard-excludes via avoid flags,
 * and does not dilute attribute matching by stuffing preferred constraints.
 */
export function applyWeatherBiasToPlan(
  plan: PlannerPlan,
  weather: CityWeatherSnapshot | null,
): PlannerPlan {
  if (!weather || weather.outdoorBias === "neutral") {
    return plan;
  }
  if (!isWeatherRelevantWorkflow(plan.workflow)) {
    return plan;
  }

  const requiredOutdoor = plan.constraints.required.outdoorSeating === true;
  const requiredAvoidOutdoor =
    plan.constraints.avoid.outdoorSeating === true;

  if (weather.outdoorBias === "favor_indoor") {
    // User hard-required outdoor — weather must not fight that.
    if (requiredOutdoor) return plan;
    return {
      ...plan,
      composition: {
        ...plan.composition,
        preferIndoorDueToWeather: true,
        preferOutdoorDueToWeather: false,
        weatherBias: "favor_indoor",
      },
      diagnostics: {
        ...plan.diagnostics,
        rulesApplied: [
          ...plan.diagnostics.rulesApplied,
          "weather_favor_indoor_rain",
        ],
      },
    };
  }

  // favor_outdoor — soft priority only
  if (requiredAvoidOutdoor) return plan;
  return {
    ...plan,
    composition: {
      ...plan.composition,
      preferIndoorDueToWeather: false,
      preferOutdoorDueToWeather: true,
      weatherBias: "favor_outdoor",
    },
    diagnostics: {
      ...plan.diagnostics,
      rulesApplied: [
        ...plan.diagnostics.rulesApplied,
        "weather_favor_outdoor",
      ],
    },
  };
}
