/**
 * Strict matching for urgent trade asks (plumber, electrician, etc.).
 * Prevents laundry / DIY / industrial stores from padding "24hr plumber" results.
 */

import type { BusinessResult } from "@/lib/schemas/business";
import { extractAttributes } from "@/lib/schemas/business-attributes";
import { isTradeOrAfterHoursServiceAsk, isAfterHoursWording, TWENTY_FOUR_HOUR_RE } from "./emergency-guard";

export type TradeKind =
  | "plumber"
  | "electrician"
  | "locksmith"
  | "tow"
  | "handyman"
  | "hvac"
  | "fabricator";

const TRADE_PATTERNS: { kind: TradeKind; re: RegExp; label: string }[] = [
  {
    kind: "fabricator",
    re: /\b(weld(?:er|ing)?|fabricat(?:e|ion|or)s?|metalwork|metal\s*work|boilermaker|steel\s*work|custom\s*fab|trailer(\s*(repair|fab|fabrication|build|mod|work))?|panel\s*beat(?:er|ing)?)\b/i,
    label: "welder / fabricator",
  },
  {
    kind: "plumber",
    re: /\bplumbers?|plumbing|burst\s*pipe|blocked\s*drain|geyser|drain\s*unblock/i,
    label: "plumber",
  },
  {
    kind: "electrician",
    re: /\belectricians?|electrical|power\s*outage|no\s*power\b/i,
    label: "electrician",
  },
  {
    kind: "locksmith",
    re: /\blocksmiths?|keys?\s*locked|locked\s*out\b/i,
    label: "locksmith",
  },
  {
    kind: "tow",
    re: /\btow(\s*truck)?|towing|flat\s*battery|breakdown\b/i,
    label: "tow truck",
  },
  {
    kind: "handyman",
    re: /\bhandyman|gate\s*motor\b/i,
    label: "handyman",
  },
  {
    kind: "hvac",
    re: /\bhvac|air[\s-]?con|air\s*conditioning\b/i,
    label: "air conditioning",
  },
];

const TRADE_MATCH: Record<TradeKind, RegExp> = {
  fabricator:
    /\b(weld(?:er|ing)?|fabricat(?:e|ion|or)|metalwork|metal\s*work|boilermaker|steel\s*work|custom\s*fab|trailer\s*(repair|fab|fabrication|build|mod|work)|panel\s*beat(?:er|ing)?)\b/i,
  plumber: /\bplumbers?|plumbing\b/i,
  electrician: /\belectricians?|electrical\b/i,
  locksmith: /\blocksmiths?\b/i,
  tow: /\btow|breakdown|roadside\b/i,
  handyman: /\bhandyman|handyman\s*services?\b/i,
  hvac: /\bhvac|air[\s-]?con|air\s*conditioning|refrigeration\b/i,
};

/** General auto service centres that must not pad fabrication / welding asks. */
const GENERAL_AUTO_SERVICE_RE =
  /\b(car\s*(repair|service|servicing|maintenance|care)|auto\s*(repair|service|specialist|fix|tech)|autobod(?:y|ies)?|body\s*shop|vehicle\s*(repair|service|assessment|maintenance|health)|motor\s*(mechanic|service)|bosch\s*car|full\s*service|ecu\s*|control\s*arm|tie\s*rod|dent\s*repair|panel\s*&\s*paint|paint\s*&?\s*panel)\b/i;

/** Off-trade categories that often pollute home-services search. */
const TRADE_OFFTOPIC_RE =
  /\b(laundry|laundromat|dry\s*clean|home\s*improvement|hardware|industrial\s*supplies|building\s*supplies|diy|paint\s*store|nursery|garden\s*centre|garden\s*center|supermarket|grocery|cafe|restaurant|hotel|estate\s*agent)\b/i;

export function detectTradeKind(message: string): TradeKind | null {
  const text = message.trim();
  if (!text) return null;
  for (const { kind, re } of TRADE_PATTERNS) {
    if (re.test(text)) return kind;
  }
  return null;
}

export function tradeLabel(kind: TradeKind): string {
  return TRADE_PATTERNS.find((t) => t.kind === kind)?.label ?? kind;
}

export function tradeResultsTitle(
  kind: TradeKind,
  openNow: boolean,
): string {
  const plural: Record<TradeKind, string> = {
    fabricator: "Welders & fabricators",
    plumber: "Plumbers",
    electrician: "Electricians",
    locksmith: "Locksmiths",
    tow: "Tow services",
    handyman: "Handymen",
    hvac: "Air-con technicians",
  };
  const label = plural[kind];
  return openNow ? `${label} to call now` : `${label} nearby`;
}

/** True when the listing is clearly a different trade than requested. */
export function matchesAnyOtherTradeKind(
  business: BusinessResult,
  kind: TradeKind,
): boolean {
  for (const other of Object.keys(TRADE_MATCH) as TradeKind[]) {
    if (other === kind) continue;
    if (matchesTradeKind(business, other)) return true;
  }
  return false;
}

export function isUrgentTradeAsk(message: string): boolean {
  return (
    isTradeOrAfterHoursServiceAsk(message) || detectTradeKind(message) != null
  );
}

/** Phrases that signal after-hours / emergency / call-out coverage on a listing. */
export const AFTER_HOURS_LISTING_RE =
  /\b(24\s*\/?\s*7|24[\s-]?h(?:r|ours?)?s?|24\s*hours?|after[\s-]?hours|emergency(\s*(call[\s-]?out|plumbing|service|repairs?))?|call[\s-]?out|night\s*service|all\s*hours|round[\s-]?the[\s-]?clock)\b/i;

export function listingAfterHoursFlags(business: BusinessResult): string[] {
  const hay = businessHaystack(business);
  const attrs = extractAttributes(business.metadata);
  const flags: string[] = [];
  if (TWENTY_FOUR_HOUR_RE.test(hay) || attrs.open24Hours === true) {
    flags.push("24-hour");
  }
  if (/after[\s-]?hours/i.test(hay) || attrs.afterHours === true) {
    flags.push("after-hours");
  }
  if (/\bemergency\b/i.test(hay) || attrs.emergencyCallOut === true) {
    flags.push("emergency");
  }
  if (/call[\s-]?out/i.test(hay) || attrs.emergencyCallOut === true) {
    flags.push("call-out");
  }
  if (/night\s*service|round[\s-]?the[\s-]?clock|all\s*hours/i.test(hay)) {
    flags.push("night service");
  }
  if (attrs.lateNight === true) {
    flags.push("night service");
  }
  return flags;
}

/** 0–1 affinity for after-hours asks (from listing text, not live hours). */
export function afterHoursAffinityScore(business: BusinessResult): number {
  const flags = listingAfterHoursFlags(business);
  if (flags.length === 0) return 0;
  let score = 0.35;
  if (flags.includes("24-hour")) score += 0.35;
  if (flags.includes("emergency")) score += 0.15;
  if (flags.includes("call-out")) score += 0.1;
  if (flags.includes("after-hours") || flags.includes("night service")) {
    score += 0.1;
  }
  return Math.min(1, score);
}

/** Search needles that keep “24 hour” / emergency wording in the retrieval path. */
export function tradeSearchQueries(
  kind: TradeKind,
  message: string,
  cityLabel = "Ballito",
): string[] {
  const label = tradeLabel(kind);
  const afterHours = isAfterHoursWording(message);
  const queries = [`${label} ${cityLabel}`];
  if (kind === "fabricator") {
    queries.push(
      `trailer fabrication ${cityLabel}`,
      `trailer welder ${cityLabel}`,
      `custom metal fabrication ${cityLabel}`,
      `welding fabrication ${cityLabel}`,
    );
  }
  if (afterHours) {
    queries.push(
      `24 hour ${label} ${cityLabel}`,
      `emergency ${label} ${cityLabel}`,
      `${label} call out ${cityLabel}`,
      `after hours ${label} ${cityLabel}`,
    );
  }
  return queries;
}

function businessHaystack(b: BusinessResult): string {
  const services = Array.isArray(b.metadata?.services)
    ? (b.metadata!.services as unknown[]).filter((s) => typeof s === "string")
    : [];
  const keywords = Array.isArray(b.metadata?.keywords)
    ? (b.metadata!.keywords as unknown[]).filter((s) => typeof s === "string")
    : [];
  return [b.name, b.category ?? "", b.description ?? "", ...services, ...keywords]
    .join(" ")
    .toLowerCase();
}

/** True when the listing is clearly the requested trade. */
export function matchesTradeKind(
  business: BusinessResult,
  kind: TradeKind,
): boolean {
  const hay = businessHaystack(business);
  const verts = Array.isArray(business.metadata?.verticals)
    ? (business.metadata!.verticals as unknown[]).filter(
        (v): v is string => typeof v === "string",
      )
    : [];

  if (kind === "fabricator") {
    const nameCat = `${business.name} ${business.category ?? ""}`;
    const strongFabCore =
      /\b(weld(?:er|ing)?|fabricat(?:e|ion|or)|boilermaker|metalwork|metal\s*work|steel\s*work|custom\s*fab|trailer\s*(repair|fab|fabrication|build|mod|work))\b/i.test(
        hay,
      );
    const namedPanelBeater =
      /\b(panel\s*beat(?:er|ing)?|paneel\s*klopper)\b/i.test(nameCat);
    const anyPanelBeater =
      namedPanelBeater ||
      /\b(panel\s*beat(?:er|ing)?|paneel\s*klopper)\b/i.test(hay);
    // Car service / panel-and-paint shops often list "panel beating" as a side
    // service — ignore that unless the business is named as a panel beater or
    // clearly does welding/fabrication.
    if (
      GENERAL_AUTO_SERVICE_RE.test(hay) &&
      !strongFabCore &&
      !namedPanelBeater
    ) {
      return false;
    }
    if (strongFabCore || anyPanelBeater || verts.includes("fabrication")) {
      return true;
    }
    return false;
  }

  if (TRADE_OFFTOPIC_RE.test(hay) && !TRADE_MATCH[kind].test(hay)) {
    return false;
  }
  return TRADE_MATCH[kind].test(hay);
}

/**
 * Keep only on-trade listings.
 *
 * Default is strict: empty is better than padding with a neighbouring trade.
 * Pass `{ strict: false }` only for rare soft-miss paths that still drop
 * laundry/DIY and never swap in a different detected trade.
 */
export function filterToTradeKind(
  businesses: BusinessResult[],
  kind: TradeKind,
  opts?: { strict?: boolean },
): BusinessResult[] {
  const matched = businesses.filter((b) => matchesTradeKind(b, kind));
  if (matched.length > 0) return matched;
  const strict = opts?.strict !== false;
  if (strict) return matched;
  return businesses.filter((b) => {
    const hay = businessHaystack(b);
    if (TRADE_OFFTOPIC_RE.test(hay)) return false;
    if (GENERAL_AUTO_SERVICE_RE.test(hay)) return false;
    if (matchesAnyOtherTradeKind(b, kind)) return false;
    return true;
  });
}
