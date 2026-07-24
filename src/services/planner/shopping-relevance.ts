/**
 * Hard relevance gate for product / buy asks.
 * Soft semantic search alone will happily return pets, lasertag, bakeries —
 * those must never reach composition for a shopping ask.
 */

import type { BusinessResult } from "@/lib/schemas/business";

function haystack(b: BusinessResult): string {
  const meta =
    b.metadata && typeof b.metadata === "object"
      ? JSON.stringify(b.metadata)
      : "";
  return [b.name, b.category, b.description, meta]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function verticals(b: BusinessResult): string[] {
  const m = b.metadata;
  if (!m || typeof m !== "object" || Array.isArray(m)) return [];
  const v = (m as { verticals?: unknown }).verticals;
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

/** Places that clearly sell or specialise in electronics / tech / gaming gear. */
const SPECIALIST_RE =
  /\b(electronics?|computer\s+(?:shop|store|repair)|phone\s+(?:shop|store)|cellphone|cell\s+phone|mobile\s+phone|tech\s+(?:shop|store)|gadget|gaming\s+(?:store|pc|gear)|hifi(?:\s+corp)?|hi[- ]?fi|incredible\s+connection|matrix(?:\s+warehouse)?|\bgame\b|makro|takealot|office\s+depot|stationery|it\s+(?:shop|store)|laptop|notebook|pc\s+(?:shop|store)|hardware\s+store.*(?:computer|electronics)|apple\s+(?:authorised|authorized)|samsung\s+experience)\b/i;

/** Shopping centres — honest related fallback only (check electronics counters). */
const MALL_RE =
  /\b(shopping\s*mall|lifestyle\s*(?:centre|center)|junction|galleria|\bmall\b|retail\s+park|shopping\s+centre|shopping\s+center)\b/i;

/** Never treat these as answers to a product buy ask. */
const REJECT_RE =
  /\b(pet\s*(?:shop|store|groom)|veterinar|vet\s+clinic|laser\s*tag|paintball|go[- ]?kart|arcade|bakery|cake\s*shop|restaurant|cafe|coffee|bar\s+and\s+grill|plumber|electric(?:ian)?|locksmith|panel\s*beat|auto\s*repair|car\s*wash|tyre|tire\s+shop|spa\b|salon|barber|gym|fitness|school|clinic|hospital|estate\s+agent|guest\s*house|hotel|laundry|dry\s*clean)\b/i;

export function isRejectedForProductAsk(business: BusinessResult): boolean {
  return REJECT_RE.test(haystack(business));
}

export function isElectronicsSpecialist(business: BusinessResult): boolean {
  if (isRejectedForProductAsk(business)) return false;
  const verts = verticals(business);
  if (verts.includes("electronics")) return true;
  const h = haystack(business);
  if (SPECIALIST_RE.test(h)) return true;
  // Shopping vertical + clear tech signal in name/category
  if (
    verts.includes("shopping") &&
    /\b(electronic|computer|phone|tech|gaming|hifi|gadget|matrix|incredible)\b/i.test(
      h,
    )
  ) {
    return true;
  }
  return false;
}

export function isShoppingMall(business: BusinessResult): boolean {
  if (isRejectedForProductAsk(business)) return false;
  if (isElectronicsSpecialist(business)) return false;
  const h = haystack(business);
  if (MALL_RE.test(h)) return true;
  if (
    verticals(business).includes("shopping") &&
    /\b(mall|junction|lifestyle|centre|center|galleria)\b/i.test(h)
  ) {
    return true;
  }
  return false;
}

/** Primary gate: only electronics / tech retailers. */
export function filterProductSpecialists(
  businesses: BusinessResult[],
): BusinessResult[] {
  return businesses.filter(isElectronicsSpecialist);
}

/** Related fallback: malls / centres where someone might find electronics counters. */
export function filterShoppingMalls(
  businesses: BusinessResult[],
): BusinessResult[] {
  return businesses.filter(isShoppingMall);
}

/**
 * Ask-fit: specialists for exact mode; malls only when grounding is related.
 * Strips anything that slipped through ranking.
 */
export function enforceProductAskFit(
  businesses: BusinessResult[],
  mode: "exact" | "related",
): BusinessResult[] {
  if (mode === "related") return filterShoppingMalls(businesses);
  return filterProductSpecialists(businesses);
}
