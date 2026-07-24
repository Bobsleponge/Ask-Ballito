/**
 * Deterministic meal-time intent for dining asks.
 * Used by planner resolver, ranking, composition, and fit-verify gate.
 */

export type MealTime = "breakfast" | "lunch" | "dinner";

const BREAKFAST_RE =
  /\b(breakfast|brunch|morning\s+(?:coffee|cafe|café|bite|meal)|best\s+breakfast)\b/i;
const LUNCH_RE = /\b(lunch|lunches|midday|lunchtime)\b/i;
const DINNER_RE =
  /\b(dinner|supper|date[- ]?night\s+dinner|evening\s+meal|romantic\s+dinner)\b/i;

/** Suburbs that are not Ballito coastal — demote when the ask is local. */
const OUT_OF_AREA_ADDRESS_RE =
  /\b(essenwood|berea|umbilo|musgrave|morningside|greyville|overport|pinetown|westville|durban\s+north|umhlanga\s+rocks|gateway)\b/i;
const LOCAL_COAST_RE =
  /\b(ballito|salt\s*rock|sheffield(\s*beach)?|zimbali|compensation|ballito\s+junction)\b/i;

/** Not a sit-down breakfast destination. */
const NON_BREAKFAST_VENUE_RE =
  /\b(hotel|guest\s*house|guesthouse|motel|lodge|resort|shopping\s*mall|shopping\s*centre|shopping\s*center|supermarket|grocery|hypermarket|butcher|hardware|pharmacy|clinic|hospital)\b/i;

const QSR_RE =
  /\b(steers|mcdonald'?s|kfc|wimpy|debonairs|spur|nando'?s|fishaways|burger\s*king|roma\s*mano|hungry\s*lion)\b/i;

const MARKET_OR_MALL_CAT_RE =
  /\b(supermarket|grocery|shopping\s*mall|shopping\s*centre|market|department\s*store)\b/i;

export function detectMealTime(message: string): MealTime | null {
  const text = message.trim();
  if (!text) return null;
  if (BREAKFAST_RE.test(text)) return "breakfast";
  if (LUNCH_RE.test(text)) return "lunch";
  if (DINNER_RE.test(text)) return "dinner";
  return null;
}

export function mealTimeSearchQueries(
  meal: MealTime,
  cityName?: string,
): string[] {
  const city = cityName?.trim();
  const suffix = city ? ` ${city}` : "";
  switch (meal) {
    case "breakfast":
      return [
        `breakfast brunch cafe${suffix}`,
        `best breakfast restaurant${suffix}`,
        `breakfast menu cafe${suffix}`,
      ];
    case "lunch":
      return [`lunch restaurants cafes${suffix}`, `best lunch${suffix}`];
    case "dinner":
      return [`dinner restaurants${suffix}`, `best dinner${suffix}`];
  }
}

export function isOutOfAreaAddress(
  address: string | null | undefined,
): boolean {
  if (!address?.trim()) return false;
  if (LOCAL_COAST_RE.test(address)) return false;
  return OUT_OF_AREA_ADDRESS_RE.test(address);
}

/** Lexical / attribute fit for a meal-time dining ask. */
export function mealTimeFitScore(
  meal: MealTime,
  input: {
    name: string;
    category: string | null;
    description: string | null;
    address?: string | null;
    breakfast?: boolean | null;
  },
): { fit: number; leanAgainst: boolean } {
  const cat = (input.category ?? "").toLowerCase();
  const hay =
    `${input.name} ${input.description ?? ""} ${cat}`.toLowerCase();
  const hasBreakfastSignal =
    input.breakfast === true || /\bbreakfast|brunch\b/.test(hay);

  if (meal === "breakfast") {
    if (input.breakfast === false) {
      return { fit: 0, leanAgainst: true };
    }

    const nonBreakfastVenue =
      NON_BREAKFAST_VENUE_RE.test(hay) ||
      MARKET_OR_MALL_CAT_RE.test(cat) ||
      QSR_RE.test(hay) ||
      /\bhotel\b/.test(cat);

    const cakeSpecialty =
      /\b(birthday\s*cakes?|wedding\s*cakes?|cupcakes?|brownies?|confection|patisserie)\b/i.test(
        hay,
      ) && !hasBreakfastSignal;
    const coffeeStand =
      /\bcoffee\s*stand\b/.test(cat) || /\bcoffee\s*stand\b/.test(hay);
    const bakeryWithoutBreakfast =
      /\bbakery\b/.test(cat) && !hasBreakfastSignal;
    const dinnerOrLunchOnly =
      !hasBreakfastSignal &&
      (/\b(portuguese restaurant|steakhouse|nightclub|sports\s*bar|cocktail\s*bar|wine\s*bar|hamburger\s*restaurant|seafood)\b/i.test(
        hay,
      ) ||
        /\blunch\s+service\b/i.test(hay) ||
        (/\brestaurant\b/.test(cat) &&
          !/\b(cafe|café|bistro|coffee)\b/.test(hay) &&
          !/\b(cafe|café|bistro)\b/.test(cat)));
    const barLean =
      /\b(bar|pub)\b/.test(cat) &&
      !/\b(cafe|coffee|breakfast|brunch)\b/.test(hay);

    const leanAgainst =
      nonBreakfastVenue ||
      cakeSpecialty ||
      coffeeStand ||
      bakeryWithoutBreakfast ||
      dinnerOrLunchOnly ||
      barLean ||
      isOutOfAreaAddress(input.address);

    let fit = 0;
    if (input.breakfast === true) fit += 3;
    if (/\bbreakfast|brunch\b/.test(hay)) fit += 3;
    if (
      /\b(cafe|café|bistro)\b/.test(cat) ||
      /\b(cafe|café|bistro)\b/.test(hay)
    ) {
      fit += hasBreakfastSignal ? 2 : 1;
    }
    if (/\brestaurant\b/.test(cat) && hasBreakfastSignal) fit += 2;
    if (
      /\bcoffee\s*shop\b/.test(cat) &&
      (hasBreakfastSignal || /\b(toastie|sarmie|breakfast)\b/.test(hay))
    ) {
      fit += 1;
    }
    if (/\bbakery\b/.test(cat) && hasBreakfastSignal) fit += 1;

    return { fit, leanAgainst };
  }

  if (meal === "lunch") {
    let fit = 0;
    if (/\blunch\b/.test(hay)) fit += 2;
    if (/\bcafe|café|bistro|restaurant|takeaway\b/.test(cat)) fit += 1;
    const against =
      NON_BREAKFAST_VENUE_RE.test(hay) ||
      MARKET_OR_MALL_CAT_RE.test(cat) ||
      QSR_RE.test(hay) ||
      isOutOfAreaAddress(input.address);
    return { fit, leanAgainst: against };
  }

  let fit = 0;
  if (/\bdinner|supper|fine dining|steakhouse|seafood\b/.test(hay)) fit += 2;
  if (/\brestaurant|bistro|grill\b/.test(cat)) fit += 1;
  const against =
    NON_BREAKFAST_VENUE_RE.test(hay) ||
    MARKET_OR_MALL_CAT_RE.test(cat) ||
    (/\b(coffee stand|birthday\s*cakes?)\b/i.test(hay) &&
      !/\bdinner|restaurant|grill\b/i.test(hay)) ||
    isOutOfAreaAddress(input.address);
  return { fit, leanAgainst: against };
}
