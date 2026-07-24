/**
 * Deterministic gate: decide whether the LLM fit-verifier should run.
 * Basic single-intent asks skip the extra OpenAI call.
 */

import { isExactNicheAsk } from "@/services/planner/exact-niche-guard";
import { isMusicInstrumentAsk } from "@/services/planner/music-intent";
import { isProductPurchaseAsk } from "@/services/planner/product-intent";
import { detectMealTime } from "@/services/planner/meal-time-intent";
import { detectTradeKind } from "@/services/planner/trade-query";
import type { PlannerPlan } from "@/services/planner/types";
import type { ExperienceComposition } from "@/services/composition/types";

const MULTI_NEED_EVENT_RE =
  /\b(house\s*party|home\s*party|at[- ]?home\s*party|propos(?:e|al|ing)|engagement|kids?\s+birthday|child(?:ren)?'?s?\s+birthday|(?:2[1-9]|[3-9]\d)(?:th|st|nd|rd)\s+birthday|turning\s+(?:2[1-9]|[3-9]\d)|anniversary|plan(?:ning)?\s+(?:a\s+)?(?:party|celebration|proposal|birthday)|special\s+occasion)\b/i;

const STAY_VENUE_RE =
  /\b(hotel|guest\s*house|guesthouse|wedding\s*venue|boutique\s*hotel|bed\s*&\s*breakfast|bnb)\b/i;

const AT_HOME_RE =
  /\b(house\s*party|home\s*party|at[- ]?home|my\s+(?:house|place|home)|bring\s+(?:food|cater)|come\s+to\s+(?:us|me|our))\b/i;

export interface FitVerifyGateInput {
  userMessage: string;
  plan: PlannerPlan;
  composition: ExperienceComposition;
}

export interface FitVerifyGateResult {
  run: boolean;
  reason: string;
}

function hasStayVenueUnderNonStaySection(
  composition: ExperienceComposition,
  atHomeAsk: boolean,
): boolean {
  if (!atHomeAsk) return false;
  const byId = new Map(composition.businesses.map((b) => [b.id, b]));
  for (const section of composition.sections) {
    if (/\b(stay|hotel|accommodation|venue)\b/i.test(section.title)) continue;
    for (const id of section.businessIds) {
      const b = byId.get(id);
      if (!b) continue;
      const hay = `${b.name} ${b.category ?? ""} ${b.description ?? ""}`;
      if (STAY_VENUE_RE.test(hay)) return true;
    }
  }
  return false;
}

/**
 * Returns whether OpenAI fit verification should run for this turn.
 */
export function shouldFitVerify(input: FitVerifyGateInput): FitVerifyGateResult {
  const { userMessage, plan, composition } = input;
  const msg = userMessage.trim();
  const facets = plan.composition.planFacets ?? [];
  const bizCount = composition.businesses.length;

  if (bizCount < 3) {
    return { run: false, reason: "too_few_businesses" };
  }

  // Meal-time dining: let OpenAI drop hotels/malls/QSR/lunch-only noise.
  const mealTime =
    detectMealTime(msg) ??
    (plan.constraints.preferred.breakfast === true
      ? "breakfast"
      : plan.constraints.preferred.lunch === true
        ? "lunch"
        : plan.constraints.preferred.dinner === true
          ? "dinner"
          : null);
  if (mealTime && plan.workflow === "restaurants" && bizCount >= 4) {
    return { run: true, reason: `meal_time_${mealTime}` };
  }

  if (
    isProductPurchaseAsk(msg) ||
    isMusicInstrumentAsk(msg) ||
    detectTradeKind(msg) != null ||
    isExactNicheAsk(msg)
  ) {
    return { run: false, reason: "exact_lexical_path" };
  }

  if (
    plan.composition.strategy === "ranked_list" &&
    composition.sections.length <= 1 &&
    facets.length < 2
  ) {
    return { run: false, reason: "simple_ranked_list" };
  }

  if (
    plan.workflow === "activities" &&
    plan.composition.bucketProfile !== "plan_facets" &&
    facets.length < 2 &&
    !MULTI_NEED_EVENT_RE.test(msg)
  ) {
    return { run: false, reason: "activities_browse" };
  }

  if (
    plan.composition.bucketProfile === "plan_facets" &&
    facets.length >= 2
  ) {
    return { run: true, reason: "multi_plan_facets" };
  }

  if (MULTI_NEED_EVENT_RE.test(msg) && facets.length >= 2) {
    return { run: true, reason: "multi_need_event_ask" };
  }

  if (MULTI_NEED_EVENT_RE.test(msg) && facets.length >= 1 && bizCount >= 4) {
    return { run: true, reason: "event_ask_with_facets" };
  }

  if (hasStayVenueUnderNonStaySection(composition, AT_HOME_RE.test(msg))) {
    return { run: true, reason: "at_home_with_stay_venues" };
  }

  if (facets.length < 2 && !MULTI_NEED_EVENT_RE.test(msg)) {
    return { run: false, reason: "not_multi_need" };
  }

  return { run: false, reason: "default_skip" };
}
