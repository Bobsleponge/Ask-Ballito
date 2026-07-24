import type { BusinessResult } from "@/lib/schemas/business";
import {
  allowlistForHint,
  allowsUntaggedForHint,
  isExactVerticalHint,
} from "@/config/vertical-policy";

/** Verticals that should almost never appear for "things to do". */
const ATTRACTIONS_VERTICAL_DENY = new Set([
  "hotels",
  "childcare",
  "banks",
  "petrol",
  "automotive",
  "fabrication",
  "plumbers",
  "electricians",
  "locksmiths",
  "handyman",
  "hvac",
  "property",
  "security",
  "telecom",
  "movers",
  "cleaning",
  "pool-services",
  "landscaping",
  "pest-control",
  "contractors",
  "legal",
  "accountants",
  "doctors",
  "dentists",
  "pharmacies",
  "optometrists",
  "hardware",
  "laundry",
  "grocery",
  "butchers",
  "vets",
  "restaurants",
  "cafes",
  "takeaways",
  "bakeries",
  "bars",
  "spas",
  "hair-salons",
  "barbershops",
  "beauticians",
  "liquor",
]);

/**
 * Hard off-intent for leisure discovery (stays, schools, services).
 */
const ATTRACTIONS_CATEGORY_DENY =
  /\b(travel\s*agency|tourist\s*information|guest\s*house|guesthouse|hotel|motel|lodging|accommodation|bed\s*&\s*breakfast|b&b|self[\s-]?catering|estate\s*agent|real\s*estate|property\s*(management|developer)|school|educational|creche|crèche|daycare|day\s*care|nursery\s*school|bank|atm|petrol|gas\s*station|car\s*(dealer|wash|rental)|plumber|electrician|clinic|hospital|pharmacy|dentist|doctor|veterinary|funeral|church|mosque|temple|attorney|lawyer|accountant)\b/i;

/**
 * Dining / retail categories that are not "things to do" unless also tagged
 * as attractions/family.
 */
const ATTRACTIONS_DINING_SHOP_DENY =
  /\b(restaurant|cafe|coffee\s*shop|bakery|bistro|steakhouse|pizza|sushi|takeaway|fast\s*food|shopping\s*mall|shopping\s*centre|shopping\s*center|supermarket|grocery|convenience\s*store|liquor|bottle\s*store|pub|wine\s*bar|cocktail\s*bar|night\s*club)\b/i;

/**
 * Categories that count as real activities when vertical tags are missing.
 */
const ACTIVITY_CATEGORY_ALLOW =
  /\b(attraction|tourist\s*attraction|beach|park|nature|museum|zoo|aquarium|adventure|tour\s*agency|tour\s*operator|activity|amusement|arcade|bowling|golf|surf|diving|dive|kayak|hike|hiking|trail|viewpoint|wildlife|laser|go[\s-]?kart|mini[\s-]?golf|water\s*park|theme\s*park|event\s*venue|entertainment|recreation|sports\s*complex|marina|harbour|harbor)\b/i;

/**
 * Categories that should never appear for restaurant / dining workflows.
 * Broader than the attractions stay/school deny — blocks malls, markets, play.
 */
const RESTAURANTS_CATEGORY_DENY =
  /\b(travel\s*agency|tourist\s*information|guest\s*house|guesthouse|hotel|motel|lodging|accommodation|bed\s*&\s*breakfast|b&b|self[\s-]?catering|estate\s*agent|real\s*estate|property\s*(management|developer)|school|educational|creche|crèche|daycare|day\s*care|nursery\s*school|bank|atm|petrol|gas\s*station|car\s*(dealer|wash|rental)|plumber|electrician|clinic|hospital|pharmacy|dentist|dental|doctor|veterinary|funeral|church|mosque|temple|attorney|lawyer|accountant|shopping\s*mall|shopping\s*centre|shopping\s*center|supermarket|grocery|convenience\s*store|butcher\s*shop|playground|soft\s*play|laser\s*tag|go[\s-]?kart|arcade|amusement|theme\s*park|clothing\s*store|apparel|guest\s*house)\b/i;

/** Dining-shaped categories (restaurants, cafes, bars, takeaways). */
const DINING_CATEGORY_ALLOW =
  /\b(restaurant|cafe|coffee|bakery|bistro|grill|steak|seafood|sushi|pizza|tapas|diner|eatery|takeaway|take[\s-]?out|fast\s*food|hamburger|burger|chicken|portuguese|italian|indian|thai|chinese|mexican|pub|bar|wine|cocktail|night\s*club|brunch|fine\s*dining)\b/i;

/** Human medical categories — never veterinary / auto / tourist. */
const HUMAN_MEDICAL_CATEGORY_ALLOW =
  /\b(doctor|gp|general\s*practi(?:ce|tioner)|physician|medical\s*(center|centre|clinic|practice|doctor)|family\s*(practice|medicine)|clinic|hospital|urgent\s*care|primary\s*care|health\s*center|health\s*centre)\b/i;

const HUMAN_MEDICAL_CATEGORY_DENY =
  /\b(veterinar|vet\s*hospital|animal\s*(hospital|clinic|care)|pet\s*(hospital|clinic|care)|car\s*(repair|service|wash)|auto\s*(repair|service|fix|body)|mechanic|panel\s*beat|tourist|travel\s*agency|airport\s*shuttle|shuttle\s*service|dentist|dental|orthodont|optometr|optician|eye\s*(exam|test|care))\b/i;

/** Per-hint hard category deny (stays/schools/etc.). */
const CATEGORY_DENY_BY_HINT: Record<string, RegExp> = {
  attractions: ATTRACTIONS_CATEGORY_DENY,
  family: ATTRACTIONS_CATEGORY_DENY,
  restaurants: RESTAURANTS_CATEGORY_DENY,
  hotels: /\b(school|educational|creche|bank|clinic|hospital|pharmacy)\b/i,
  doctors: HUMAN_MEDICAL_CATEGORY_DENY,
  hospitals: HUMAN_MEDICAL_CATEGORY_DENY,
  healthcare: /\b(veterinar|vet\s*hospital|animal\s*(hospital|clinic|care)|pet\s*(hospital|clinic|care)|car\s*(repair|service)|auto\s*(repair|service|fix)|mechanic|tourist|travel\s*agency|airport\s*shuttle|shuttle\s*service)\b/i,
};

export function verticalsFromMetadata(
  metadata: Record<string, unknown> | undefined | null,
): string[] {
  if (!metadata || typeof metadata !== "object") return [];
  const raw = metadata.verticals;
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === "string" && v.length > 0);
}

/**
 * Maps workflow `verticalHint` values to allowlisted ingest vertical slugs
 * (see config/vertical-policy.ts). Unknown hints return null (= no filter).
 */
export function resolveVerticalAllowlist(
  hint: unknown,
): readonly string[] | null {
  return allowlistForHint(hint);
}

function categoryHaystack(business: BusinessResult): string {
  return [business.category ?? "", business.name, business.description ?? ""]
    .join(" ")
    .toLowerCase();
}

function matchesCategoryDeny(business: BusinessResult, hint: string): boolean {
  const re = CATEGORY_DENY_BY_HINT[hint];
  if (!re) return false;
  return re.test(categoryHaystack(business));
}

function hasCoreActivityVertical(verticals: string[]): boolean {
  return (
    verticals.includes("attractions") ||
    verticals.includes("family") ||
    verticals.includes("fitness")
  );
}

function isDiningOrShopCategory(business: BusinessResult): boolean {
  return ATTRACTIONS_DINING_SHOP_DENY.test(categoryHaystack(business));
}

function looksLikeActivity(business: BusinessResult): boolean {
  return ACTIVITY_CATEGORY_ALLOW.test(categoryHaystack(business));
}

/**
 * Whether a business fits a workflow vertical hint.
 */
export function matchesVerticalHint(
  business: BusinessResult,
  hint: unknown,
): boolean {
  if (typeof hint !== "string" || !hint.trim()) return true;
  const key = hint.trim().toLowerCase();
  const allowlist = resolveVerticalAllowlist(key);
  if (!allowlist) return true;

  if (matchesCategoryDeny(business, key)) return false;

  const verticals = verticalsFromMetadata(business.metadata);

  if (key === "attractions" || key === "family") {
    if (hasCoreActivityVertical(verticals)) return true;
    if (verticals.includes("shopping")) return true;
    if (verticals.some((v) => ATTRACTIONS_VERTICAL_DENY.has(v))) return false;
    if (
      /\bshopping\s*mall|shopping\s*centre|shopping\s*center\b/i.test(
        categoryHaystack(business),
      )
    ) {
      return true;
    }
    if (isDiningOrShopCategory(business)) return false;
    if (verticals.length === 0) return looksLikeActivity(business);
    return verticals.some((v) => allowlist.includes(v));
  }

  // Exact service intents: untagged rows must not pad the result set.
  // Dining browse: untagged may pass only when the category looks like food/drink.
  // Doctors/hospitals: untagged may pass only when category looks like human medical.
  if (verticals.length === 0) {
    if (key === "restaurants") {
      return DINING_CATEGORY_ALLOW.test(categoryHaystack(business));
    }
    if (key === "doctors" || key === "hospitals") {
      const hay = categoryHaystack(business);
      if (HUMAN_MEDICAL_CATEGORY_DENY.test(hay)) return false;
      return HUMAN_MEDICAL_CATEGORY_ALLOW.test(hay);
    }
    return allowsUntaggedForHint(key);
  }
  return verticals.some((v) => allowlist.includes(v));
}

/** True when the listing is food/drink shaped (vertical or category). */
export function isDiningBusiness(business: BusinessResult): boolean {
  if (matchesCategoryDeny(business, "restaurants")) return false;
  const verticals = verticalsFromMetadata(business.metadata);
  if (
    verticals.some((v) =>
      ["restaurants", "cafes", "takeaways", "bakeries", "bars"].includes(v),
    )
  ) {
    return true;
  }
  return DINING_CATEGORY_ALLOW.test(categoryHaystack(business));
}

/**
 * Graded intent for ranking: real attractions beat soft leisure leftovers.
 */
export function verticalIntentScore(
  business: BusinessResult,
  hint: unknown,
): number {
  if (typeof hint !== "string" || !hint.trim()) return 1;
  const key = hint.trim().toLowerCase();
  if (key !== "attractions" && key !== "family") {
    if (!matchesVerticalHint(business, hint)) {
      // Hard exclude off-vertical for dining, medical, and exact intents.
      if (
        key === "restaurants" ||
        key === "doctors" ||
        key === "hospitals" ||
        key === "healthcare" ||
        isExactVerticalHint(key)
      ) {
        return 0;
      }
      return 0.08;
    }
    return 1;
  }

  if (!matchesVerticalHint(business, hint)) return 0.05;

  const verticals = verticalsFromMetadata(business.metadata);
  if (verticals.includes("attractions") || verticals.includes("family")) {
    return 1;
  }
  if (looksLikeActivity(business)) return 0.95;
  if (verticals.includes("fitness")) return 0.8;
  if (
    verticals.includes("shopping") ||
    /\bshopping\s*mall\b/i.test(categoryHaystack(business))
  ) {
    return 0.38;
  }
  return 0.65;
}

export function filterByVerticalHint(
  businesses: BusinessResult[],
  hint: unknown,
): BusinessResult[] {
  if (typeof hint !== "string" || !hint.trim()) return businesses;
  if (!resolveVerticalAllowlist(hint)) return businesses;
  return businesses.filter((b) => matchesVerticalHint(b, hint));
}

/** Extract verticalHint from the first business_search step that has one. */
export function verticalHintFromPlan(plan: {
  executionPlan?: Array<{ params?: Record<string, unknown> }>;
}): string | null {
  const steps = plan.executionPlan ?? [];
  for (const step of steps) {
    const hint = step.params?.verticalHint;
    if (typeof hint === "string" && hint.trim()) return hint.trim();
  }
  return null;
}

/** Leisure-oriented section titles from vertical tags (avoids raw Google cats). */
export function leisureBucketFromVerticals(
  business: BusinessResult,
): string | null {
  const verts = verticalsFromMetadata(business.metadata);
  if (verts.includes("attractions")) return "Experiences & attractions";
  if (verts.includes("family")) return "Kids & family";
  if (verts.includes("fitness")) return "Active & fitness";
  if (looksLikeActivity(business)) return "Experiences & attractions";
  if (verts.includes("shopping")) return "Shopping & stroll";
  if (verts.includes("spas")) return "Spas & wellness";
  if (verts.includes("bars")) return "Drinks & nightlife";
  if (
    verts.includes("restaurants") ||
    verts.includes("cafes") ||
    verts.includes("takeaways") ||
    verts.includes("bakeries")
  ) {
    return "Food & drink";
  }
  if (verts.includes("hotels")) return null;
  return null;
}

/** Categories that should never become their own leisure section titles. */
export function isRawCategoryUnsuitableForSection(
  category: string | null | undefined,
): boolean {
  if (!category?.trim()) return false;
  return (
    ATTRACTIONS_CATEGORY_DENY.test(category) ||
    ATTRACTIONS_DINING_SHOP_DENY.test(category)
  );
}

/** Stays / schools / services — never soft-fill these into an itinerary. */
export function isHardOffIntentCategory(
  category: string | null | undefined,
): boolean {
  if (!category?.trim()) return false;
  return ATTRACTIONS_CATEGORY_DENY.test(category);
}

/** Vague activity phrasing that should not be used as the sole embedding query. */
export const VAGUE_ACTIVITY_QUERY_RE =
  /\b(fun|weekend|things to do|something to do|what to do|activities|to do)\b/i;

/** Stronger retrieval queries for vague "fun weekend" style asks. */
export const DEFAULT_ACTIVITY_SEARCH_QUERIES = [
  "family activities kids experiences adventure tours",
  "laser tag beach rides outdoor adventure entertainment",
  "nature wildlife viewpoints coastal walks",
  "shopping centres malls cinema arcade",
] as const;
