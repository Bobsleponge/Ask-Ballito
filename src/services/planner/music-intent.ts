/**
 * Music / instrument service asks (restring, repair, lessons, shops).
 * Must never fall through to automotive / vibe browsing.
 */

import type { BusinessResult } from "@/lib/schemas/business";

const MUSIC_ASK_RE =
  /\b(guitar|guitars|ukulele|bass\s*guitar|violin|viola|cello|piano|keyboard\s*instrument|drum(?:s|kit)?|flute|saxophone|trumpet|banjo|mandolin|harmonica|restring(?:ing)?|new\s*strings|instrument\s*(?:repair|shop|store)|music\s*(?:shop|store|lessons?)|luthier|guitar\s*(?:shop|store|repair|lesson)|piano\s*(?:tuner|tuning|repair))\b/i;

export function isMusicInstrumentAsk(text: string): boolean {
  return MUSIC_ASK_RE.test(text.trim());
}

export function extractMusicLabel(text: string): string {
  const t = text.trim();
  if (/\brestring/i.test(t) && /\bguitar/i.test(t)) return "guitar restringing";
  if (/\brestring/i.test(t)) return "instrument restringing";
  if (/\bguitar/i.test(t) && /\b(repair|fix|setup)/i.test(t)) {
    return "guitar repair";
  }
  if (/\bpiano\s*tun/i.test(t)) return "piano tuning";
  if (/\bmusic\s*lesson/i.test(t)) return "music lessons";
  if (/\bguitar/i.test(t)) return "guitar services";
  if (/\binstrument/i.test(t)) return "music instruments";
  return "music / instrument services";
}

export function musicSearchQueries(label: string, cityName: string): string[] {
  const city = cityName.trim() || "Ballito";
  return [
    `music shop ${city}`,
    `guitar shop ${city}`,
    `guitar restringing ${city}`,
    `musical instrument store ${city}`,
    `${label} ${city}`,
    `piano shop ${city}`,
  ];
}

export function musicEmptyMessage(label: string): string {
  return `I couldn't find a dedicated music shop or instrument service in Ballito's directory for ${label}. If you know a mall music counter (or a shop in Umhlanga / Durban North), I can help with something else nearby — or try asking for a specific shop name.`;
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

function verticals(b: BusinessResult): string[] {
  const m = b.metadata;
  if (!m || typeof m !== "object" || Array.isArray(m)) return [];
  const v = (m as { verticals?: unknown }).verticals;
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

const MUSIC_SPECIALIST_RE =
  /\b(music\s*(?:shop|store)|guitar|luthier|instrument|piano|drum|violin|ukulele|sheet\s*music|restring|strings?\s*(?:shop|store)|musical)\b/i;

const REJECT_RE =
  /\b(auto\s*repair|panel\s*beat|car\s*(?:service|wash|repair)|tyre|tire\s*shop|locksmith|plumber|electric(?:ian)?|pet\s*(?:shop|store)|surf\s*shop|hardware|gelmar|mechanic)\b/i;

export function isMusicSpecialist(business: BusinessResult): boolean {
  if (REJECT_RE.test(haystack(business))) return false;
  if (verticals(business).includes("music-instruments")) return true;
  return MUSIC_SPECIALIST_RE.test(haystack(business));
}

export function filterMusicSpecialists(
  businesses: BusinessResult[],
): BusinessResult[] {
  return businesses.filter(isMusicSpecialist);
}
