/**
 * Auto parts retail asks (car battery, jump starters, etc.).
 * Avoids generic exact-niche fail-closed on "battery car".
 */

import type { BusinessResult } from "@/lib/schemas/business";

const AUTO_PARTS_ASK_RE =
  /\b((?:car|auto|vehicle)\s*batter(?:y|ies)|batter(?:y|ies)\s+for\s+(?:my\s+)?(?:car|auto|vehicle)|jump\s*starts?(?:er)?s?|jumper\s*cables?|(?:car|auto)\s*parts?|spare\s*parts?\s+for\s+(?:my\s+)?(?:car|auto)|alternator|starter\s*motor|brake\s*pads?)\b/i;

export function isAutoPartsAsk(text: string): boolean {
  return AUTO_PARTS_ASK_RE.test(text.trim());
}

export function extractAutoPartsLabel(text: string): string {
  const t = text.trim();
  if (/\bbatter/i.test(t)) return "car battery";
  if (/\bjump\s*start|jumper\s*cable/i.test(t)) return "jump starter";
  if (/\balternator\b/i.test(t)) return "alternator";
  if (/\bstarter\s*motor\b/i.test(t)) return "starter motor";
  if (/\bbrake\s*pads?\b/i.test(t)) return "brake pads";
  if (/\bparts?\b/i.test(t)) return "car parts";
  return "auto parts";
}

export function autoPartsSearchQueries(label: string, cityName: string): string[] {
  const city = cityName.trim() || "Ballito";
  return [
    `car battery ${city}`,
    `auto parts ${city}`,
    `battery shop ${city}`,
    `tyre battery ${city}`,
    `${label} ${city}`,
    `spares ${city}`,
    `Tiger Wheel & Tyre ${city}`,
  ];
}

export function autoPartsEmptyMessage(label: string): string {
  return `I couldn't find a clear local shop for ${label} in Ballito's directory yet. Try an auto-parts / battery specialist or a tyre centre that stocks batteries — I won't pad the reply with unrelated places.`;
}

/**
 * Build match text without JSON-stringifying amenity schemas.
 * Listing fields include keys like `"massage": null` that false-trigger rejects.
 */
function haystack(b: BusinessResult): string {
  const bits: string[] = [b.name, b.category, b.description].filter(
    (v): v is string => typeof v === "string" && v.length > 0,
  );
  const meta =
    b.metadata && typeof b.metadata === "object"
      ? (b.metadata as Record<string, unknown>)
      : null;
  if (meta) {
    for (const key of ["verticals", "types", "categories"] as const) {
      const raw = meta[key];
      if (Array.isArray(raw)) {
        for (const item of raw) {
          if (typeof item === "string" && item.trim()) bits.push(item);
        }
      }
    }
    const enrichment = meta.enrichment;
    if (enrichment && typeof enrichment === "object") {
      const enr = enrichment as Record<string, unknown>;
      for (const key of ["services", "keywords", "products"] as const) {
        const raw = enr[key];
        if (Array.isArray(raw)) {
          for (const item of raw) {
            if (typeof item === "string" && item.trim()) bits.push(item);
          }
        }
      }
    }
  }
  return bits.join(" ").toLowerCase();
}

const SPECIALIST_RE =
  /\b(batter(?:y|ies)|auto[_\s-]?parts?(?:_store)?|spare\s*parts?|motor\s*spares?|jump\s*start|jumper\s*cable|alternator|brake\s*pad|tyre|tire[_\s-]?shop|wheel\s*&\s*tyre|spares?|automotive\s*(?:parts|spares)|fitment|windscreen|car\s*glass)\b/i;

const REJECT_RE =
  /\b(plumber|electrician|locksmith|hair\s*salon|nail\s*salon|restaurant|cafe|spa|massage|music\s*(?:shop|store)|guitar|surf\s*shop)\b/i;

export function isAutoPartsSpecialist(business: BusinessResult): boolean {
  const hay = haystack(business);
  // Reject only on public listing text — amenity key names must not count.
  const publicHay = [business.name, business.category, business.description]
    .filter((v): v is string => typeof v === "string" && v.length > 0)
    .join(" ")
    .toLowerCase();
  if (REJECT_RE.test(publicHay)) return false;
  return SPECIALIST_RE.test(hay);
}

export function filterAutoPartsSpecialists(
  businesses: BusinessResult[],
): BusinessResult[] {
  return businesses.filter(isAutoPartsSpecialist);
}
