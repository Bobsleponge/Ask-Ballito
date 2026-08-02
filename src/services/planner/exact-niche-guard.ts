/**
 * App-wide exact-niche guard.
 *
 * Exact asks (specific job/product/service) must never pad with leisure
 * "Ideas by vibe" neighbours. Ask-fit keeps only businesses that lexically
 * match the ask; empty is allowed and preferred over wrong cards.
 */

import type { BusinessResult } from "@/lib/schemas/business";
import type { ExperienceComposition } from "@/services/composition/types";
import { isProductPurchaseAsk } from "./product-intent";
import { isMusicInstrumentAsk } from "./music-intent";
import { isAutoProtectionAsk } from "./auto-protection-intent";
import { isAutoPartsAsk } from "./auto-parts-intent";
import { detectTradeKind } from "./trade-query";

const BROWSE_RE =
  /\b((things|stuff)\s+to\s+do|weekend\s+ideas?|day\s+out|itinerary|somewhere\s+nice|anything\s+nice|what'?s\s+(good|on|fun)|suggest(?:ions?)?|recommendations?\s+for\s+(a\s+)?(day|weekend|night)|explore\s+ballito|vibes?|show\s+me\s+(some\s+)?options)\b/i;

const EXACT_VERB_RE =
  /\b(need|needs|want|looking\s+for|where\s+(?:can|to|do)\s+(?:i|we)|help\s+me|can\s+you\s+(?:find|get|fix)|fix(?:ing)?|repair(?:ing)?|install(?:ing)?|buy|purchase|get\s+me|restring(?:ing)?|book\s+me|call\s+out|broken|burst|leaking)\b/i;

/** Leisure / dining discovery — do not treat as fail-closed niche. */
const LEISURE_TOPIC_RE =
  /\b(restaurant|dinner|lunch|brunch|coffee|cafe|sushi|pizza|breakfast|hotel|stay|beach|surf\s*lesson|activity|activities|kids?\s+play|date\s+night|propos(?:e|al|ing)|engagement|anniversary|special\s+occasion)\b/i;

const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "to",
  "for",
  "of",
  "in",
  "on",
  "at",
  "my",
  "me",
  "i",
  "we",
  "you",
  "is",
  "are",
  "do",
  "does",
  "can",
  "please",
  "help",
  "find",
  "get",
  "need",
  "needs",
  "want",
  "looking",
  "where",
  "some",
  "any",
  "near",
  "nearby",
  "ballito",
  "with",
  "from",
  "this",
  "that",
  "have",
  "has",
  "was",
  "been",
  "just",
  "like",
  "local",
  "shop",
  "store",
  "service",
  "services",
]);

export function isLeisureBrowseAsk(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (BROWSE_RE.test(t)) return true;
  // Dining / leisure topics without a hard job verb → browse.
  if (LEISURE_TOPIC_RE.test(t) && !EXACT_VERB_RE.test(t)) return true;
  return false;
}

/**
 * True for specific job/product/service asks that must fail closed
 * rather than pad with unrelated neighbours.
 */
export function isExactNicheAsk(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (
    isProductPurchaseAsk(t) ||
    isMusicInstrumentAsk(t) ||
    isAutoProtectionAsk(t) ||
    isAutoPartsAsk(t)
  ) {
    return true;
  }
  if (detectTradeKind(t) != null) return true;
  if (isLeisureBrowseAsk(t)) return false;

  const needles = extractAskNeedles(t);
  if (needles.length === 0) return false;

  // Verb + concrete needles (e.g. "I need to restring my guitar").
  if (EXACT_VERB_RE.test(t) && needles.length >= 1) return true;

  // Bare niche phrases that still imply a specific seek.
  if (
    /\b(restring(?:ing)?|burst\s+pipe|panel\s*beat|weld(?:ing|er)?|geyser|fibre\s+install|gaming\s+mouse)\b/i.test(
      t,
    )
  ) {
    return true;
  }

  return false;
}

/** Content tokens used for ask-fit matching. */
export function extractAskNeedles(text: string): string[] {
  const raw = text.toLowerCase().match(/[a-z0-9][a-z0-9'-]*/g) ?? [];
  const out: string[] = [];
  for (const tok of raw) {
    if (tok.length < 3) continue;
    if (STOPWORDS.has(tok)) continue;
    if (!out.includes(tok)) out.push(tok);
  }
  // Prefer longer / rarer tokens first for scoring.
  return out.sort((a, b) => b.length - a.length);
}

export function extractExactNicheLabel(text: string): string {
  const needles = extractAskNeedles(text).slice(0, 4);
  if (needles.length === 0) return "that request";
  return needles.join(" ");
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

/**
 * Lexical ask-fit: keep businesses that share meaningful tokens with the ask.
 * Exact mode fails closed when nothing matches.
 */
export function businessFitsAsk(
  business: BusinessResult,
  askOrNeedles: string | string[],
): boolean {
  const needles = Array.isArray(askOrNeedles)
    ? askOrNeedles
    : extractAskNeedles(askOrNeedles);
  if (needles.length === 0) return false;

  const h = haystack(business);
  const hits = needles.filter((n) => h.includes(n));
  if (hits.length === 0) return false;

  // One strong needle (≥4 chars) or two shorter ones.
  if (hits.some((n) => n.length >= 4)) return true;
  return hits.length >= 2;
}

export function filterByAskFit(
  businesses: BusinessResult[],
  ask: string,
): BusinessResult[] {
  const needles = extractAskNeedles(ask);
  if (needles.length === 0) return [];
  return businesses.filter((b) => businessFitsAsk(b, needles));
}

export function exactNicheEmptyMessage(label: string): string {
  const nice =
    label === "that request" ? "what you're looking for" : `"${label}"`;
  return `I couldn't find a clear local match for ${nice} in Ballito's directory yet. Try a more specific shop or trade name — I won't pad the reply with unrelated places.`;
}

/** Strip composition down to ask-fit survivors (immutable). */
export function applyAskFitToComposition(
  composition: ExperienceComposition,
  ask: string,
): ExperienceComposition {
  const fitted = filterByAskFit(composition.businesses, ask);
  if (fitted.length === composition.businesses.length) return composition;
  const ids = new Set(fitted.map((b) => b.id));
  return {
    ...composition,
    businesses: fitted,
    sections: composition.sections
      .map((section) => ({
        ...section,
        businessIds: section.businessIds.filter((id) => ids.has(id)),
      }))
      .filter((section) => section.businessIds.length > 0),
  };
}
