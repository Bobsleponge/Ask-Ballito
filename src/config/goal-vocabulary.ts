/** Synonym map for goal.primary normalisation. */
const GOAL_SYNONYMS: Record<string, string> = {
  anniversary_dinner: "celebrate_anniversary",
  romantic_evening: "celebrate_anniversary",
  anniversary: "celebrate_anniversary",
  propose_engagement: "plan_special_occasion",
  engagement: "plan_special_occasion",
  proposal: "plan_special_occasion",
  propose: "plan_special_occasion",
  wedding_proposal: "plan_special_occasion",
  kids_birthday: "kids_birthday",
  child_birthday: "kids_birthday",
  birthday_party: "kids_birthday",
  plan_celebration: "plan_celebration",
  moving: "relocate_to_area",
  relocating: "relocate_to_area",
  move_to_ballito: "relocate_to_area",
  emergency: "emergency_assist",
  medical_emergency: "emergency_assist",
  family_holiday: "find_family_beach_stay",
  beach_apartment: "find_family_beach_stay",
  investment_property: "buy_investment_property",
  airbnb_property: "buy_investment_property",
};

export function normaliseGoalPrimary(primary: string): string {
  const key = primary.trim().toLowerCase().replace(/\s+/g, "_");
  return GOAL_SYNONYMS[key] ?? key;
}
