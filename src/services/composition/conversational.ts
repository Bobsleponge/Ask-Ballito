import type { BusinessResult } from "@/lib/schemas/business";
import type { ExperienceComposition } from "./types";

export interface ConversationalCompositionOptions {
  /** Preferred intro (e.g. knowledge-card headline). Softened if too terse. */
  introHint?: string | null;
  /** City display name for fallback intros. */
  cityName?: string;
  /** When true, lean practical/call-first (services workflows). */
  servicesTone?: boolean;
}

function firstSentence(text: string | null | undefined, maxLen = 90): string | null {
  if (!text) return null;
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  const cut = cleaned.split(/(?<=[.!?])\s+/)[0] ?? cleaned;
  if (cut.length <= maxLen) return cut;
  const truncated = cut.slice(0, maxLen);
  const lastSpace = truncated.lastIndexOf(" ");
  return `${(lastSpace > 40 ? truncated.slice(0, lastSpace) : truncated).trim()}…`;
}

function priceLabel(level: number | null | undefined): string | null {
  if (level == null || level < 1) return null;
  return "R".repeat(Math.min(4, Math.max(1, level)));
}

function highlightName(name: string): string {
  return `**${name}**`;
}

/** One short clause about why a place fits — grounded in listing fields only. */
function standoutClause(b: BusinessResult): string {
  const name = highlightName(b.name);
  const rating =
    b.rating != null && b.rating >= 4
      ? `${b.rating % 1 === 0 ? b.rating.toFixed(0) : b.rating.toFixed(1)}★`
      : null;
  const category = b.category?.trim() || null;
  const price = priceLabel(b.priceLevel);
  const tip = firstSentence(b.description, 70);

  if (rating && category) {
    return `${name} (${rating}, ${category.toLowerCase()})`;
  }
  if (rating) return `${name} (${rating})`;
  if (category && tip) return `${name} — ${category.toLowerCase()}, ${tip.charAt(0).toLowerCase()}${tip.slice(1)}`;
  if (category) return `${name} for ${category.toLowerCase()}`;
  if (price) return `${name} (${price})`;
  if (tip) return `${name} — ${tip.charAt(0).toLowerCase()}${tip.slice(1)}`;
  return name;
}

function softenIntro(
  hint: string | null | undefined,
  cityName: string,
  total: number,
  servicesTone: boolean,
): string {
  const trimmed = hint?.replace(/\s+/g, " ").trim() ?? "";
  const city = cityName.trim() || "Ballito";

  if (servicesTone) {
    if (trimmed) {
      const base = trimmed.replace(/[:—\-]+\s*$/, "").trim();
      return /[.!?]$/.test(base) ? base : `${base}.`;
    }
    return total === 1
      ? `Here's a solid option in ${city} for what you need.`
      : `Here are a few solid options in ${city} — start with whoever fits the job best.`;
  }

  if (trimmed) {
    let base = trimmed.replace(/[:—\-]+\s*$/, "").trim();
    if (!/[.!?]$/.test(base)) base = `${base}.`;
    // Already a full conversational line — don't pile on a CTA.
    if (/[?]/.test(base) || base.split(/\s+/).length >= 10) {
      return base;
    }
    if (/tap|cards? below|take a look/i.test(base)) {
      return base;
    }
    return `${base.slice(0, -1)} — take a look at the cards below.`;
  }

  if (total <= 1) {
    return `I've got a good pick for you in ${city}.`;
  }
  if (total <= 3) {
    return `I've pulled together a few solid options in ${city}.`;
  }
  return `Here's a nice mix of local picks in ${city} for you.`;
}

function sectionBlurb(
  businesses: BusinessResult[],
  servicesTone: boolean,
): string {
  if (businesses.length === 0) {
    return "Nothing strong enough landed in this section — try a slightly different ask.";
  }

  const lead = businesses[0]!;
  const second = businesses[1];

  if (servicesTone) {
    const phone = lead.phone?.trim();
    const leadBit = phone
      ? `${standoutClause(lead)} — try them on **${phone}**`
      : standoutClause(lead);
    if (!second) {
      return `${leadBit}. Worth a call to confirm they can help.`;
    }
    return `${leadBit}. ${highlightName(second.name)} is a strong backup if you want another quote.`;
  }

  if (!second) {
    return `${standoutClause(lead)} is a great place to start — open the card for details.`;
  }

  if (businesses.length === 2) {
    return `${standoutClause(lead)} is a strong start, and ${standoutClause(second)} is worth a look too.`;
  }

  const rest = businesses.length - 2;
  const more =
    rest === 1
      ? "There's one more in the cards below."
      : `There are a few more in the cards below if you want options.`;
  return `${standoutClause(lead)} is a strong start, and ${highlightName(second.name)} is a nice alternative. ${more}`;
}

/**
 * Warm, structured narration for deterministic paths (no LLM).
 * Emits the same <<<INTRO>>> / <<<SECTION:…>>> markers the UI already parses.
 */
export function formatCompositionConversational(
  composition: ExperienceComposition,
  options: ConversationalCompositionOptions = {},
): string {
  if (composition.sections.length === 0 || composition.businesses.length === 0) {
    return "";
  }

  const byId = new Map(composition.businesses.map((b) => [b.id, b]));
  const cityName = options.cityName?.trim() || "Ballito";
  const servicesTone = Boolean(options.servicesTone);
  const total = composition.businesses.length;

  const introHint =
    options.introHint?.trim() ||
    composition.title?.trim() ||
    null;

  const intro = softenIntro(introHint, cityName, total, servicesTone);

  const blocks: string[] = [`<<<INTRO>>>`, intro];

  for (const section of composition.sections) {
    const businesses = section.businessIds
      .map((id) => byId.get(id))
      .filter((b): b is BusinessResult => b != null);
    if (businesses.length === 0) continue;
    blocks.push(`<<<SECTION:${section.title}>>>`, sectionBlurb(businesses, servicesTone));
  }

  return blocks.join("\n");
}
