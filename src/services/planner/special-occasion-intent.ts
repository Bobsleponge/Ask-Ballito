/**
 * Dynamic celebration / event-plan facets from the planner LLM.
 * Search steps and UI sections follow facets — no hard-coded proposal checklist.
 */

import { normaliseGoalPrimary } from "@/config/goal-vocabulary";
import { policyForHint } from "@/config/vertical-policy";
import type { BusinessResult } from "@/lib/schemas/business";
import { verticalsFromMetadata } from "@/lib/business-vertical-filter";
import type { ExecutionStep, PlanFacet } from "./types";

const CELEBRATION_SIGNAL_RE =
  /\b(propos(?:e|al|ing)|engagement|anniversary|birthday|special\s+occasion|wedding|celebration|party\s+plan|plan(?:ning)?\s+(?:a\s+)?(?:party|celebration|proposal))\b/i;

const ROMANTIC_DINNER_ONLY_RE =
  /\b(romantic\s+dinner|dinner\s+date|date\s+night|romantic\s+restaurant|romantic\s+meal)\b/i;

const KIDS_SIGNAL_RE =
  /\b(kids?|child(?:ren)?|son'?s?|daughter'?s?|toddler|family)\b/i;

const BIRTHDAY_RE = /\bbirthday\b/i;

const PROPOSAL_SIGNAL_RE =
  /\b(propos(?:e|al|ing)|engagement|engage(?:d)?|marry|wedding\s+proposal|will\s+you\s+marry)\b/i;

/** Adult ages / ordinals that imply a milestone (not a kids party). */
const ADULT_MILESTONE_RE =
  /\b(?:turning\s+)?(?:2[1-9]|[3-9]\d)(?:th|st|nd|rd)?(?:\s+birthday)?\b|\b(?:21st|30th|40th|50th|60th|70th|80th)\b|\bmilestone\s+birthday\b/i;

const ELEVATED_WORDING_RE =
  /\b(nice\s+dinner|special\s+dinner|upscale|fancy|fine\s+dining|cocktail\s+(?:bar|lounge)|celebratory\s+dinner)\b/i;

/** User asked for cheap/casual — do not force upscale. */
const CASUAL_BUDGET_ASK_RE =
  /\b(cheap|budget|casual|affordable|not\s+fancy|low[\s-]?key|inexpensive)\b/i;

const JEWELLERY_NOISE_RE =
  /\b(jewell?er|jewell?ery|diamond\s*buyer|gold\s*buyer|engagement\s*ring)\b/i;

const WEDDING_VENUE_NOISE_RE =
  /\b(wedding\s*venue|bridal|honeymoon)\b/i;

const KIDS_PLAY_RE =
  /\b(laser\s*tag|go[\s-]?kart|arcade|playground|soft\s*play|trampoline|kids?\s*play|mini[\s-]?golf|bowling|amusement|theme\s*park|water\s*park|bambini|sugar\s*rush)\b/i;

const MAX_FACETS = 7;

export function isCelebrationAsk(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (ROMANTIC_DINNER_ONLY_RE.test(t) && !CELEBRATION_SIGNAL_RE.test(t)) {
    return false;
  }
  return CELEBRATION_SIGNAL_RE.test(t);
}

/** @deprecated Prefer isCelebrationAsk + planFacets; kept for soft romantic bias. */
export function isSpecialOccasionAsk(text: string): boolean {
  return isCelebrationAsk(text);
}

export function isSpecialOccasionGoal(primary: string): boolean {
  const p = normaliseGoalPrimary(primary);
  return (
    p === "plan_special_occasion" ||
    p === "celebrate_anniversary" ||
    p === "kids_birthday" ||
    p === "plan_celebration"
  );
}

export function isProposalAsk(text: string): boolean {
  return PROPOSAL_SIGNAL_RE.test(text.trim());
}

export function isKidsCelebrationAsk(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (BIRTHDAY_RE.test(t) && KIDS_SIGNAL_RE.test(t)) return true;
  if (/\bkids?\s+party\b/i.test(t)) return true;
  return false;
}

/** Turning 40 / 30th / milestone birthday — not a kids party. */
export function isAdultMilestoneAsk(text: string): boolean {
  const t = text.trim();
  if (!t || isKidsCelebrationAsk(t)) return false;
  return ADULT_MILESTONE_RE.test(t);
}

/**
 * Celebrations that warrant higher-register dining (budget/ranking lean).
 * Does not force romantic; proposal/anniversary still set romantic separately.
 */
export function isElevatedCelebrationAsk(text: string): boolean {
  const t = text.trim();
  if (!t || isKidsCelebrationAsk(t) || CASUAL_BUDGET_ASK_RE.test(t)) {
    return false;
  }
  if (isAdultMilestoneAsk(t)) return true;
  if (isProposalAsk(t)) return true;
  if (/\banniversary\b/i.test(t)) return true;
  return ELEVATED_WORDING_RE.test(t);
}

export function isCasualBudgetAsk(text: string): boolean {
  return CASUAL_BUDGET_ASK_RE.test(text.trim());
}

export function sanitizePlanFacets(
  facets: PlanFacet[] | null | undefined,
): PlanFacet[] {
  if (!facets?.length) return [];
  const out: PlanFacet[] = [];
  const seen = new Set<string>();

  for (const raw of facets) {
    if (out.length >= MAX_FACETS) break;
    const label = (raw.label ?? "").trim().slice(0, 80);
    const searchQuery = (raw.searchQuery ?? "").trim().slice(0, 160);
    if (!label || !searchQuery) continue;

    let id = (raw.id ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
    if (!id) id = `facet_${out.length + 1}`;
    if (seen.has(id)) id = `${id}_${out.length + 1}`;
    seen.add(id);

    let verticalHint: string | null = null;
    if (typeof raw.verticalHint === "string" && raw.verticalHint.trim()) {
      const hint = raw.verticalHint.trim().toLowerCase();
      verticalHint = policyForHint(hint) ? hint : null;
    }

    out.push({ id, label, searchQuery, verticalHint });
  }

  return out;
}

/** SA casual / QSR brands wrong for elevated adult celebrations. */
export const ELEVATED_CASUAL_CHAIN_RE =
  /\b(steers|rocomamas|rocomama'?s|mcdonald'?s|kfc|burger\s*king|debonairs|fishaways|nando'?s|chicken\s*licken|spur\s*steak|wimpy|ocean\s*basket|simply\s*asia|mugg\s*&\s*bean|seattle\s*coffee|vidi'?s|pedros|pedro'?s|bird\s*&\s*co|bird\s*and\s*co)\b/i;

/** Drop casual chains from dining facets on elevated asks (before compose/verify). */
export function filterElevatedCasualDining(
  businesses: BusinessResult[],
  opts: { elevated: boolean; facets: PlanFacet[] },
): BusinessResult[] {
  if (!opts.elevated) return businesses;
  return businesses.filter((b) => {
    const facetId = getPlanFacetId(b);
    const facet = opts.facets.find((f) => f.id === facetId);
    const hay = `${b.name} ${b.category ?? ""}`;
    const dining =
      (facet != null && isDiningPlanFacet(facet)) ||
      /restaurant|burger|grill|dining|fast\s*food/i.test(hay);
    if (!dining) return true;
    return !ELEVATED_CASUAL_CHAIN_RE.test(hay);
  });
}

/** Dining / drinks facets — deeper search + more cards in the section. */
export function isDiningPlanFacet(facet: {
  label: string;
  searchQuery: string;
  verticalHint: string | null;
}): boolean {
  if (
    facet.verticalHint === "restaurants" ||
    facet.verticalHint === "nightlife" ||
    facet.verticalHint === "cafes"
  ) {
    return true;
  }
  return /restaurant|dinner|dining|brunch|cocktail|bar|wine|meal|celebrate|lunch|cafe|bistro/i.test(
    `${facet.label} ${facet.searchQuery}`,
  );
}

function facetHay(f: PlanFacet): string {
  return `${f.id} ${f.label} ${f.searchQuery}`;
}

function hasFacetMatching(facets: PlanFacet[], re: RegExp): boolean {
  return facets.some((f) => re.test(facetHay(f)));
}

/**
 * Keep celebration plans broad and on-tone.
 * Adult milestones must not keep kids/family dinner facets (Steers path).
 */
export function enrichCelebrationFacets(
  facets: PlanFacet[],
  text: string,
): PlanFacet[] {
  let out = sanitizePlanFacets(facets);
  if (out.length === 0) return out;
  if (isKidsCelebrationAsk(text) || isProposalAsk(text)) return out;

  const adultParty =
    isAdultMilestoneAsk(text) ||
    (/\b(birthday|party|celebration)\b/i.test(text) &&
      !isCasualBudgetAsk(text));

  if (!adultParty) return out;

  // Rewrite kids/family tone the planner wrongly applied to adult milestones.
  if (isAdultMilestoneAsk(text)) {
    out = out.map((f) => {
      const hay = facetHay(f);
      if (
        isDiningPlanFacet(f) &&
        /family|kids|child|friendly/i.test(hay)
      ) {
        return {
          id: f.id.includes("dinner") || f.id.includes("dining")
            ? f.id
            : "birthday_dinner",
          label: "Birthday dinner",
          searchQuery:
            "special occasion dinner sea view cocktail restaurant Ballito",
          verticalHint: "restaurants" as string | null,
        };
      }
      if (
        /kids?\s*(entertain|activit|party|play)|soft\s*play|laser|trampoline/i.test(
          hay,
        )
      ) {
        return {
          id: "entertainment",
          label: "Entertainment",
          searchQuery: "DJ hire photographer photo booth party entertainment",
          verticalHint: "events" as string | null,
        };
      }
      return f;
    });
    out = sanitizePlanFacets(out);
  }

  const dining = out.filter(isDiningPlanFacet);
  const nonDining = out.filter((f) => !isDiningPlanFacet(f));

  // Dining-only collapse → one dinner (+ optional drinks), then add party services.
  if (dining.length >= 2 && nonDining.length === 0) {
    const dinner =
      dining.find((f) =>
        /dinner|dining|restaurant|meal/i.test(facetHay(f)),
      ) ?? dining[0]!;
    const drinks = dining.find((f) =>
      /cocktail|bar|drinks|nightlife/i.test(facetHay(f)),
    );
    const wantsSea = dining.some((f) =>
      /sea\s*view|ocean|beachfront/i.test(facetHay(f)),
    );
    const dinnerQuery = wantsSea
      ? `${dinner.searchQuery} sea view special occasion`.trim().slice(0, 160)
      : dinner.searchQuery;
    out = [
      {
        id: dinner.id || "dinner",
        label: /dinner|dining|restaurant/i.test(dinner.label)
          ? dinner.label
          : "Birthday dinner",
        searchQuery: dinnerQuery,
        verticalHint: dinner.verticalHint ?? "restaurants",
      },
    ];
    if (drinks && drinks.id !== out[0]!.id) {
      out.push({
        id: drinks.id || "drinks",
        label: /cocktail|bar|drink/i.test(drinks.label)
          ? drinks.label
          : "Cocktails & drinks",
        searchQuery: drinks.searchQuery,
        verticalHint: drinks.verticalHint ?? "nightlife",
      });
    }
  }

  const atHome = /\b(house\s*party|at[- ]?home|my\s+(?:house|place|home))\b/i.test(
    text,
  );
  const birthday =
    /\bbirthday\b/i.test(text) || isAdultMilestoneAsk(text);

  if (
    !hasFacetMatching(
      out,
      /entertain|dj|photograph|photo\s*booth|music\s*hire|live\s*music/i,
    ) &&
    out.length < MAX_FACETS
  ) {
    out.push({
      id: "entertainment",
      label: "Entertainment",
      searchQuery: "DJ hire photographer photo booth party entertainment",
      verticalHint: "events",
    });
  }

  if (
    birthday &&
    !hasFacetMatching(out, /cake|bakery|dessert/i) &&
    out.length < MAX_FACETS
  ) {
    out.push({
      id: "cake",
      label: "Birthday cake",
      searchQuery: "birthday cake bakery",
      verticalHint: "bakeries",
    });
  }

  if (
    !atHome &&
    /\b(party|celebration|birthday)\b/i.test(text) &&
    !hasFacetMatching(
      out,
      /party\s*venue|function\s*room|event\s*venue|banquet|hall\s*hire|birthday\s*venue/i,
    ) &&
    out.length < MAX_FACETS
  ) {
    out.push({
      id: "venue",
      label: "Party venue",
      searchQuery: "party venue function room hire",
      verticalHint: "events",
    });
  }

  return sanitizePlanFacets(out);
}

/** Build execution steps from planner facets (one search per facet). */
export function executionPlanFromFacets(facets: PlanFacet[]): ExecutionStep[] {
  return facets.map((facet, i) => ({
    id: facet.id,
    capability: "business_search" as const,
    type: "business_search" as const,
    query: facet.searchQuery,
    params: {
      limit: isDiningPlanFacet(facet) ? 30 : 8,
      ...(facet.verticalHint ? { verticalHint: facet.verticalHint } : {}),
      planFacetId: facet.id,
      planFacetLabel: facet.label,
    },
    priority: i + 1,
    optional: true,
  }));
}

/** Soft title from ask + goal — not a fixed proposal string. */
export function celebrationTitleHint(
  text: string,
  goalDescription?: string,
  goalPrimary?: string,
): string {
  if (isAdultMilestoneAsk(text)) {
    return "Plan the celebration";
  }
  if (isKidsCelebrationAsk(text) || /kids_birthday|kids/i.test(goalPrimary ?? "")) {
    return "Plan the birthday";
  }
  if (BIRTHDAY_RE.test(text) || /birthday/i.test(goalPrimary ?? "")) {
    return "Plan the birthday";
  }
  if (isProposalAsk(text) || /propos|engagement/i.test(goalPrimary ?? "")) {
    return "Plan your proposal";
  }
  if (/anniversary/i.test(text) || /anniversary/i.test(goalPrimary ?? "")) {
    return "Plan your anniversary";
  }
  const desc = (goalDescription ?? "").trim();
  if (desc.length > 8 && desc.length < 60) {
    return desc.charAt(0).toUpperCase() + desc.slice(1);
  }
  return "Plan your celebration";
}

function haystack(b: BusinessResult): string {
  const services = Array.isArray(b.metadata?.services)
    ? (b.metadata!.services as unknown[]).filter((s) => typeof s === "string")
    : [];
  const keywords = Array.isArray(b.metadata?.keywords)
    ? (b.metadata!.keywords as unknown[]).filter((s) => typeof s === "string")
    : [];
  return [b.name, b.description ?? "", b.category ?? "", ...services, ...keywords]
    .join(" ")
    .toLowerCase();
}

function facetTargetsJewellery(facets: PlanFacet[]): boolean {
  return facets.some(
    (f) =>
      f.verticalHint === "jewellery" ||
      /jewell|ring|diamond/i.test(`${f.label} ${f.searchQuery}`),
  );
}

function facetTargetsKidsPlay(facets: PlanFacet[]): boolean {
  return facets.some((f) =>
    /kids|play|party\s*venue|laser|arcade|trampoline|sugar|family\s*fun/i.test(
      `${f.label} ${f.searchQuery}`,
    ),
  );
}

/**
 * Soft filter: drop clearly off-audience listings unless a facet asked for them.
 * Family celebrations → drop jewellers/wedding venues unless facet targets them.
 * Romantic/proposal without kids-play facets → soft-drop laser/arcade noise.
 */
export function filterCelebrationAudienceNoise(
  businesses: BusinessResult[],
  opts: {
    familyFriendly?: boolean | null;
    romantic?: boolean | null;
    kidsAsk?: boolean;
    facets: PlanFacet[];
  },
): BusinessResult[] {
  // Do not treat bare "birthday" facets as family — adult milestones share that word.
  const familyLean =
    opts.kidsAsk ||
    opts.familyFriendly === true ||
    opts.facets.some((f) =>
      /kids|family|child(?:ren)?|soft\s*play|kids?\s*play|play\s*venue|trampoline|laser\s*tag/i.test(
        `${f.label} ${f.searchQuery}`,
      ),
    );
  const romanticLean =
    opts.romantic === true ||
    opts.facets.some((f) =>
      /propos|engagement|romantic|anniversary/i.test(
        `${f.label} ${f.searchQuery}`,
      ),
    );
  const allowJewellery = facetTargetsJewellery(opts.facets);
  const allowKidsPlay = facetTargetsKidsPlay(opts.facets) || familyLean;

  return businesses.filter((b) => {
    const verts = verticalsFromMetadata(b.metadata);
    const hay = haystack(b);

    if (familyLean && !allowJewellery) {
      if (
        verts.includes("jewellery") ||
        JEWELLERY_NOISE_RE.test(hay) ||
        (verts.includes("events") && WEDDING_VENUE_NOISE_RE.test(hay))
      ) {
        return false;
      }
    }

    if (romanticLean && !allowKidsPlay && !familyLean) {
      if (KIDS_PLAY_RE.test(hay)) return false;
    }

    return true;
  });
}

/** @deprecated Use filterCelebrationAudienceNoise */
export function filterSpecialOccasionNoise(
  businesses: BusinessResult[],
): BusinessResult[] {
  return filterCelebrationAudienceNoise(businesses, {
    romantic: true,
    facets: [],
  });
}

/** Tag a business with the facet that retrieved it. */
export function withPlanFacet(
  b: BusinessResult,
  facetId: string,
  facetLabel?: string,
): BusinessResult {
  return {
    ...b,
    metadata: {
      ...(b.metadata ?? {}),
      planFacetId: facetId,
      ...(facetLabel ? { planFacetLabel: facetLabel } : {}),
    },
  };
}

export function getPlanFacetId(b: BusinessResult): string | null {
  const id = b.metadata?.planFacetId;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}
