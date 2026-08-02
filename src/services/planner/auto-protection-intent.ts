/**
 * Auto paint-protection / wrap / tint / ceramic / detailing asks.
 * Must not fail-closed as a generic exact niche ("ppf car") or pad with
 * unrelated mechanics / tyre shops.
 */

import type { BusinessResult } from "@/lib/schemas/business";

const AUTO_PROTECTION_ASK_RE =
  /\b(ppf|paint\s*protection(\s*film)?|clear\s*bra|car\s*wraps?|vehicle\s*wraps?|vinyl\s*wraps?|window\s*tints?|car\s*tints?|ceramic\s*coat(?:ing)?|graphene\s*coat(?:ing)?|auto\s*detail(?:ing)?|car\s*detail(?:ing)?|vehicle\s*detail(?:ing)?|paint\s*protection)\b/i;

export function isAutoProtectionAsk(text: string): boolean {
  return AUTO_PROTECTION_ASK_RE.test(text.trim());
}

export function extractAutoProtectionLabel(text: string): string {
  const t = text.trim();
  if (/\bppf\b/i.test(t) || /paint\s*protection(\s*film)?/i.test(t) || /clear\s*bra/i.test(t)) {
    return "paint protection film (PPF)";
  }
  if (/\b(car|vehicle|vinyl)\s*wraps?\b/i.test(t)) return "car wrap";
  if (/\b(window|car)\s*tints?\b/i.test(t)) return "window tint";
  if (/\b(ceramic|graphene)\s*coat(?:ing)?\b/i.test(t)) return "ceramic coating";
  if (/\bdetail(?:ing)?\b/i.test(t)) return "auto detailing";
  return "car paint protection";
}

export function autoProtectionSearchQueries(
  label: string,
  cityName: string,
): string[] {
  const city = cityName.trim() || "Ballito";
  return [
    `PPF paint protection film ${city}`,
    `car wrap ${city}`,
    `window tint ${city}`,
    `ceramic coating ${city}`,
    `auto detailing ${city}`,
    `${label} ${city}`,
    `paint protection ${city}`,
  ];
}

export function autoProtectionEmptyMessage(label: string): string {
  return `I couldn't find a dedicated PPF / wrap / tint / detailing shop in Ballito's directory for ${label} yet. Try a nearby North Coast specialist name, or ask for car detailing or panel & paint — I won't pad the reply with unrelated mechanics.`;
}

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

const SPECIALIST_RE =
  /\b(ppf|paint\s*protection|clear\s*bra|wrap(?:ping|s)?|tint(?:ing)?|ceramic\s*coat|graphene\s*coat|detail(?:ing)?|valet|paint\s*protect|vinyl\s*wrap)\b/i;

const REJECT_RE =
  /\b(plumber|electric(?:ian)?|locksmith|hair\s*salon|nail\s*salon|pet\s*(?:shop|store)|surf\s*shop|hardware|gelmar|music\s*(?:shop|store)|guitar)\b/i;

/** Pure tyre / general mechanic without protection/detailing signal. */
const WEAK_AUTO_ONLY_RE =
  /\b(tyre|tire\s*shop|wheel\s*&\s*tyre|oil\s*change|service\s*centre|service\s*center|tow\s*truck)\b/i;

export function isAutoProtectionSpecialist(business: BusinessResult): boolean {
  const hay = haystack(business);
  if (REJECT_RE.test(hay)) return false;
  if (SPECIALIST_RE.test(hay)) return true;
  // Automotive vertical alone is not enough — need protection/detailing language.
  if (WEAK_AUTO_ONLY_RE.test(hay) && !SPECIALIST_RE.test(hay)) return false;
  return false;
}

export function filterAutoProtectionSpecialists(
  businesses: BusinessResult[],
): BusinessResult[] {
  return businesses.filter(isAutoProtectionSpecialist);
}
