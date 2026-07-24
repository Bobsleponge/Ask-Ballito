import type { BusinessResult } from "@/lib/schemas/business";
import {
  leisureBucketFromVerticals,
  verticalsFromMetadata,
} from "@/lib/business-vertical-filter";

function haystack(b: BusinessResult): string {
  const services = Array.isArray(b.metadata?.services)
    ? (b.metadata!.services as unknown[]).filter((s) => typeof s === "string")
    : [];
  const keywords = Array.isArray(b.metadata?.keywords)
    ? (b.metadata!.keywords as unknown[]).filter((s) => typeof s === "string")
    : [];
  return [
    b.name,
    b.category ?? "",
    b.description ?? "",
    ...services,
    ...keywords,
  ]
    .join(" ")
    .toLowerCase();
}

const BEACH_RE =
  /\b(beaches|shore|lagoon|tidal\s*pool|willard|thompson'?s?|salt\s*rock\s*beach|compensation\s*beach|dolphin\s*coast|\bbeach\b)\b/i;

const ADVENTURE_RE =
  /\b(tour|adventure|laser|go[\s-]?kart|mini[\s-]?golf|arcade|bowling|surf|kayak|quad|zipline|zip[\s-]?line|boat\s*ride|beach\s*ride|entertainment|amusement|theme\s*park|water\s*park|event\s*venue)\b/i;

const FAMILY_RE =
  /\b(family|kids|children|playground|kids\s*area|soft\s*play)\b/i;

const OUTDOOR_RE =
  /\b(park|nature|trail|hike|hiking|viewpoint|wildlife|reserve|botanical|outdoor)\b/i;

const FITNESS_RE =
  /\b(gym|fitness|crossfit|padel|tennis|sport|yoga\s*studio)\b/i;

const MALL_RE =
  /\b(shopping\s*mall|shopping\s*centre|shopping\s*center|lifestyle\s*centre|lifestyle\s*center|mall|junction)\b/i;

const MALL_ENTERTAINMENT_RE =
  /\b(arcade|cinema|movie|theatre|theater|bowling|laser|kids\s*play|play\s*area|entertainment|games|trampoline)\b/i;

const MALL_FOOD_RE =
  /\b(food\s*court|restaurants?|cafes?|market|dining|eat|brunch|coffee)\b/i;

const SPA_RE = /\b(spa|massage|wellness|sauna|jacuzzi)\b/i;

/**
 * True for coastline / beach listings (not tour operators with "beach rides").
 */
export function isBeachLike(b: BusinessResult): boolean {
  if (
    /\btour\s*agency|tour\s*operator|event_venue\b/i.test(b.category ?? "")
  ) {
    return false;
  }
  const hay = haystack(b);
  if (ADVENTURE_RE.test(hay) && !/^\s*beach\s*$/i.test(b.category ?? "")) {
    // e.g. beach rides / surf school → not a beach listing
    if (!/\bbeach\b/i.test(b.category ?? "") && !/^\s*beach\s*$/i.test(b.category ?? "")) {
      return false;
    }
  }
  return (
    BEACH_RE.test(hay) ||
    /^\s*beach\s*$/i.test(b.category ?? "") ||
    /\bbeach\b/i.test(b.category ?? "")
  );
}

/** Preferred section order — distinctive experiences first; beaches later. */
export const ACTIVITY_SECTION_PRIORITY: readonly string[] = [
  "Adventure & experiences",
  "Kids & family",
  "Outdoors & nature",
  "Get active",
  "Malls with entertainment",
  "Malls for food & browse",
  "Shopping centres",
  "Beaches & coastline",
  "Spas & unwind",
  "More options",
];

/** Rainy-day order: indoor / covered first; beaches last. */
export const ACTIVITY_SECTION_PRIORITY_INDOOR: readonly string[] = [
  "Malls with entertainment",
  "Malls for food & browse",
  "Shopping centres",
  "Kids & family",
  "Adventure & experiences",
  "Spas & unwind",
  "Get active",
  "More options",
  "Outdoors & nature",
  "Beaches & coastline",
];

/**
 * Sunny / dry order: still lead with experiences/family — everyone already
 * knows the beach, so coastline is a later section, not the opener.
 */
export const ACTIVITY_SECTION_PRIORITY_OUTDOOR: readonly string[] = [
  "Adventure & experiences",
  "Kids & family",
  "Outdoors & nature",
  "Get active",
  "Malls with entertainment",
  "Malls for food & browse",
  "Shopping centres",
  "Beaches & coastline",
  "Spas & unwind",
  "More options",
];

/**
 * Activity-first bucket: beaches share one section; malls split by vibe.
 */
export function activityBucket(b: BusinessResult): string | null {
  const hay = haystack(b);
  const verts = verticalsFromMetadata(b.metadata);
  const isMall =
    verts.includes("shopping") ||
    MALL_RE.test(hay) ||
    /\bshopping\s*mall\b/i.test(b.category ?? "");

  if (isMall) {
    if (MALL_ENTERTAINMENT_RE.test(hay)) return "Malls with entertainment";
    if (MALL_FOOD_RE.test(hay)) return "Malls for food & browse";
    return "Shopping centres";
  }

  // Tours / rides / venues before generic beach wording ("beach rides").
  if (
    /\btour\s*agency|tour\s*operator|event_venue\b/i.test(b.category ?? "") ||
    (ADVENTURE_RE.test(hay) && !/^\s*beach\s*$/i.test(b.category ?? ""))
  ) {
    return "Adventure & experiences";
  }

  // Beaches share one section; multiple coastline options may appear as cards.
  if (isBeachLike(b)) {
    return "Beaches & coastline";
  }

  if (
    verts.includes("family") ||
    FAMILY_RE.test(hay)
  ) {
    return "Kids & family";
  }

  if (verts.includes("fitness") || FITNESS_RE.test(hay)) {
    return "Get active";
  }

  if (OUTDOOR_RE.test(hay)) return "Outdoors & nature";

  if (verts.includes("spas") || SPA_RE.test(hay)) return "Spas & unwind";

  if (verts.includes("attractions")) return "Adventure & experiences";

  const fromVertical = leisureBucketFromVerticals(b);
  if (fromVertical === "Experiences & attractions") {
    return "Adventure & experiences";
  }
  if (fromVertical === "Kids & family") return "Kids & family";
  if (fromVertical === "Active & fitness") return "Get active";
  if (fromVertical === "Shopping & stroll") return "Shopping centres";
  if (fromVertical === "Spas & wellness") return "Spas & unwind";

  return "More options";
}

export function activitySectionSortKey(
  title: string,
  preferIndoor = false,
  preferOutdoor = false,
): number {
  const order = preferIndoor
    ? ACTIVITY_SECTION_PRIORITY_INDOOR
    : preferOutdoor
      ? ACTIVITY_SECTION_PRIORITY_OUTDOOR
      : ACTIVITY_SECTION_PRIORITY;
  const idx = order.indexOf(title);
  return idx === -1 ? order.length : idx;
}
