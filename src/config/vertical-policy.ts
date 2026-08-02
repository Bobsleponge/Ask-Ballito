/**
 * App-wide vertical intent policy.
 *
 * Exact service asks must never be padded with neighbouring industries.
 * Browse/family hints may widen retrieval; related fallbacks use `adjacent`
 * only when primary is empty and the ask is not an exact trade.
 */

import { VERTICALS } from "@/config/verticals";

/** How strictly a vertical hint filters candidates. */
export type VerticalStrictness = "exact" | "family" | "browse";

export interface VerticalPolicy {
  /** Workflow / resolver hint key. */
  hint: string;
  /** Ingest vertical slugs allowed in primary retrieval. */
  allowlist: readonly string[];
  strictness: VerticalStrictness;
  /**
   * Optional neighbours for related-only fallback — never used in primary
   * allowlist for exact hints.
   */
  adjacent?: readonly string[];
}

function exact(hint: string, adjacent?: readonly string[]): VerticalPolicy {
  return {
    hint,
    allowlist: [hint],
    strictness: "exact",
    ...(adjacent ? { adjacent } : {}),
  };
}

function family(
  hint: string,
  allowlist: readonly string[],
  adjacent?: readonly string[],
): VerticalPolicy {
  return {
    hint,
    allowlist,
    strictness: "family",
    ...(adjacent ? { adjacent } : {}),
  };
}

function browse(
  hint: string,
  allowlist: readonly string[],
): VerticalPolicy {
  return { hint, allowlist, strictness: "browse" };
}

/**
 * Explicit policies for workflow hints. Service verticals default to exact
 * via {@link policyForHint} even if omitted here, as long as they exist in
 * VERTICALS.
 */
const POLICY_BY_HINT: Record<string, VerticalPolicy> = {
  // Leisure / browse
  attractions: browse("attractions", [
    "attractions",
    "family",
    "fitness",
    "shopping",
    "entertainment",
    "golf",
  ]),
  family: browse("family", ["family", "attractions"]),
  restaurants: browse("restaurants", [
    "restaurants",
    "cafes",
    "takeaways",
    "bakeries",
    "bars",
  ]),
  hotels: exact("hotels"),
  shopping: exact("shopping"),
  fitness: exact("fitness"),
  bars: exact("bars"),

  // Beauty family (ombre-style niche asks may related-fallback here)
  spas: family("spas", ["spas", "hair-salons", "barbershops", "beauticians"]),

  // Healthcare family — human care only (vets are exact "vets", never mixed in)
  healthcare: family("healthcare", [
    "doctors",
    "dentists",
    "pharmacies",
    "optometrists",
    "physio",
    "hospitals",
  ]),

  // Schools alias
  childcare: exact("childcare"),
  schools: family("schools", ["childcare"]),

  // Legacy umbrella — only when explicitly hinted; prefer discrete trades.
  "home-services": family("home-services", [
    "plumbers",
    "electricians",
    "locksmiths",
    "handyman",
    "hvac",
  ]),

  // Exact service verticals (also auto-covered by defaultExactPolicy)
  plumbers: exact("plumbers"),
  electricians: exact("electricians"),
  locksmiths: exact("locksmiths"),
  handyman: exact("handyman"),
  hvac: exact("hvac"),
  fabrication: exact("fabrication"),
  automotive: exact("automotive"),
  "panel-beaters": exact("panel-beaters", ["automotive"]),
  tyres: exact("tyres", ["automotive"]),
  electronics: exact("electronics", ["shopping"]),
  "sporting-goods": exact("sporting-goods", ["shopping"]),
  furniture: exact("furniture", ["shopping"]),
  "surf-shops": exact("surf-shops", ["shopping"]),
  "baby-toys": exact("baby-toys", ["shopping", "family"]),
  stationery: exact("stationery", ["shopping"]),
  "bike-shops": exact("bike-shops", ["shopping"]),
  marine: exact("marine", ["shopping", "surf-shops"]),
  "music-instruments": exact("music-instruments"),
  "pet-shops": exact("pet-shops", ["vets"]),
  property: exact("property"),
  security: exact("security"),
  telecom: exact("telecom"),
  movers: exact("movers"),
  cleaning: exact("cleaning"),
  "pool-services": exact("pool-services"),
  landscaping: exact("landscaping"),
  "pest-control": exact("pest-control"),
  contractors: exact("contractors"),
  legal: exact("legal"),
  accountants: exact("accountants"),
  doctors: exact("doctors", ["hospitals"]),
  dentists: exact("dentists"),
  pharmacies: exact("pharmacies"),
  optometrists: exact("optometrists"),
  vets: exact("vets"),
  laundry: exact("laundry"),
  banks: exact("banks"),
  petrol: exact("petrol"),
  hardware: exact("hardware"),
  florists: exact("florists"),
  grocery: exact("grocery"),
  butchers: exact("butchers"),
  liquor: exact("liquor"),
  bakeries: exact("bakeries"),
  takeaways: exact("takeaways"),
  cafes: exact("cafes"),
  "hair-salons": exact("hair-salons"),
  barbershops: exact("barbershops"),
  beauticians: exact("beauticians"),

  // Gap-fill verticals
  physio: exact("physio", ["doctors", "hospitals"]),
  travel: exact("travel"),
  "car-rental": exact("car-rental"),
  entertainment: exact("entertainment", ["attractions", "family"]),
  clothing: exact("clothing", ["shopping"]),
  footwear: exact("footwear", ["shopping", "clothing"]),
  jewellery: exact("jewellery", ["shopping"]),
  insurance: exact("insurance", ["accountants"]),
  "car-dealerships": exact("car-dealerships", ["automotive"]),
  solar: exact("solar", ["electricians"]),
  hospitals: exact("hospitals", ["doctors"]),
  photography: exact("photography"),
  events: exact("events"),
  golf: exact("golf", ["attractions", "fitness"]),
  "garden-centres": exact("garden-centres", ["landscaping", "hardware"]),
  "blinds-flooring": exact("blinds-flooring", ["furniture", "hardware"]),
  paint: exact("paint", ["hardware"]),
  "appliance-repair": exact("appliance-repair", ["handyman"]),
  // Battery / spares asks: parts shops + tyre centres that stock batteries.
  // Keep exact so generic mechanics are not primary padding.
  "auto-parts": {
    hint: "auto-parts",
    allowlist: ["auto-parts", "tyres"],
    strictness: "exact",
    adjacent: ["automotive"],
  },
  tattoo: exact("tattoo", ["beauticians"]),
  "pet-grooming": exact("pet-grooming", ["pet-shops", "vets"]),
  storage: exact("storage", ["movers"]),
  "skip-hire": exact("skip-hire", ["cleaning"]),
  architects: exact("architects", ["contractors"]),
  books: exact("books", ["stationery", "shopping"]),
  funeral: exact("funeral"),
  "shoe-repair": exact("shoe-repair", ["footwear"]),
  employment: exact("employment"),
  "debt-collection": exact("debt-collection", ["legal"]),
  "farm-supplies": exact("farm-supplies", ["hardware"]),
};

function defaultExactPolicy(hint: string): VerticalPolicy | null {
  if (!VERTICALS.some((v) => v.slug === hint)) return null;
  return exact(hint);
}

/** Resolve policy for a workflow vertical hint. */
export function policyForHint(hint: unknown): VerticalPolicy | null {
  if (typeof hint !== "string") return null;
  const key = hint.trim().toLowerCase();
  if (!key) return null;
  return POLICY_BY_HINT[key] ?? defaultExactPolicy(key);
}

/** Primary retrieval allowlist, or null if unknown hint (no filter). */
export function allowlistForHint(hint: unknown): readonly string[] | null {
  const policy = policyForHint(hint);
  if (!policy || policy.allowlist.length === 0) return null;
  return policy.allowlist;
}

export function strictnessForHint(hint: unknown): VerticalStrictness | null {
  return policyForHint(hint)?.strictness ?? null;
}

/** Exact intents must fail closed rather than pad with neighbours. */
export function isExactVerticalHint(hint: unknown): boolean {
  return strictnessForHint(hint) === "exact";
}

/**
 * Whether untagged businesses (no metadata.verticals) may pass the hint filter.
 * Browse/family can soft-enter; exact must not.
 */
export function allowsUntaggedForHint(hint: unknown): boolean {
  const s = strictnessForHint(hint);
  return s === "browse" || s === "family";
}

/** Sanity: every VERTICALS slug has an exact (or explicit) policy. */
export function assertVerticalPoliciesComplete(): void {
  for (const v of VERTICALS) {
    const policy = policyForHint(v.slug);
    if (!policy) {
      throw new Error(`Missing vertical policy for slug: ${v.slug}`);
    }
  }
}
