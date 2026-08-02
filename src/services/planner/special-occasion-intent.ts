/**
 * Dynamic celebration / event-plan facets from the planner LLM.
 * Search steps and UI sections follow facets — no hard-coded proposal checklist.
 */

import { normaliseGoalPrimary } from "@/config/goal-vocabulary";
import { policyForHint } from "@/config/vertical-policy";
import type { BusinessResult } from "@/lib/schemas/business";
import {
  isDiningBusiness,
  matchesVerticalHint,
  verticalsFromMetadata,
} from "@/lib/business-vertical-filter";
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

/**
 * Spouse/partner alone or kids-free downtime — NOT a celebration/party.
 * "special day off from the kids" must not become "Plan your celebration".
 */
const ADULT_DOWNTIME_RE =
  /\b((?:day|time)\s+off\s+from\s+(?:the\s+)?kids|without\s+(?:the\s+)?kids|kids?\s*[- ]?free|child[- ]?free|adult\s+(?:only\s+)?(?:time|day|downtime)|(?:^|\b)me\s*time\b|(?:husband|wife|partner|spouse).{0,48}(?:day\s+off|alone|without\s+(?:the\s+)?kids|time\s+(?:alone|off))|(?:day|afternoon|morning)\s+off\s+(?:for|to)\s+(?:my\s+)?(?:husband|wife|partner|spouse))\b/i;

const JEWELLERY_NOISE_RE =
  /\b(jewell?er|jewell?ery|diamond\s*buyer|gold\s*buyer|engagement\s*ring)\b/i;

const WEDDING_VENUE_NOISE_RE =
  /\b(wedding\s*venue|bridal|honeymoon)\b/i;

const KIDS_PLAY_RE =
  /\b(laser\s*tag|go[\s-]?kart|arcade|playground|soft\s*play|trampoline|kids?\s*play|mini[\s-]?golf|bowling|amusement|theme\s*park|water\s*park|bambini|sugar\s*rush)\b/i;

const MAX_FACETS = 7;

/** Initial cards shown per proposal/celebration section before Load more. */
export const CELEBRATION_SECTION_ITEM_CAP = 9;

/** Do not show a celebration section with fewer than this many options. */
export const CELEBRATION_SECTION_ITEM_MIN = 3;

/** Fetch enough candidates so each section can fill the initial cap. */
const FACET_SEARCH_LIMIT = 18;
const DINING_FACET_SEARCH_LIMIT = 30;

export function isCelebrationAsk(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (ROMANTIC_DINNER_ONLY_RE.test(t) && !CELEBRATION_SIGNAL_RE.test(t)) {
    return false;
  }
  return CELEBRATION_SIGNAL_RE.test(t);
}

/** Kids-free / spouse alone downtime — spa, quiet dining, outdoors (not a party). */
export function isAdultDowntimeAsk(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  // Parties / proposals / anniversaries / birthdays win over downtime wording.
  if (CELEBRATION_SIGNAL_RE.test(t)) return false;
  if (isKidsCelebrationAsk(t) || isProposalAsk(t)) return false;
  return ADULT_DOWNTIME_RE.test(t);
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

const HINT_ALIASES: Record<string, string> = {
  nightlife: "bars",
  night_life: "bars",
  drinks: "bars",
  cocktail: "bars",
  cocktails: "bars",
};

const SCENIC_FACET_RE =
  /\b(scenic|backdrop|viewpoint|view\s*spot|sea\s*view|ocean\s*view|beachfront|natural\s*charm|photo\s*spot|proposal\s*spot)\b/i;

const PHOTO_FACET_RE =
  /\b(photograph|photographer|photo\s*booth|engagement\s*photo|proposal\s*photo)\b/i;

const FLORIST_FACET_RE =
  /\b(florist|flower|bouquet|floral)\b/i;

/** Junk that must never pad photography / florist / scenic / dining / leisure facets. */
const FACET_JUNK_RE =
  /\b(funeral|attorney|lawyer|legal\s*practice|real\s*estate|estate\s*agent|recruitment|employment\s*agenc|handyman|general\s*contractor|curtain|blind|shutter|carpet|flooring|furniture\s*store|architect|travel\s*agency|accommodation|guest\s*house|guesthouse)\b/i;

/** Retail / mall / cleaning noise that pads vague "activities" facets. */
const LEISURE_JUNK_RE =
  /\b(shopping\s*mall|lifestyle\s*centre|lifestyle\s*center|totalsports|outdoor\s*warehouse|trappers|we\s*clean|clothing\s*store|sportswear|sports\s*store|furniture|cleaning\s*service|dry\s*clean|laundromat)\b/i;

const LEISURE_JUNK_VERTICALS = new Set([
  "shopping",
  "clothing",
  "cleaning",
  "electronics",
  "furniture",
  "legal",
  "funeral",
  "handyman",
  "employment",
  "blinds-flooring",
  "property",
  "architects",
  "contractors",
  "travel",
]);

const LEISURE_KEEP_VERTICALS = new Set([
  "spas",
  "attractions",
  "beaches",
  "fitness",
  "golf",
  "bars",
  "restaurants",
  "cafes",
  "nightlife",
]);

const LEISURE_KEEP_RE =
  /\b(spa|massage|wellness|golf|horse\s*trail|gym|fitness|personal\s*train|beach|surf|kayak|hike|trail|adventure|outdoor\s*activit)\b/i;

const PHOTO_KEEP_RE =
  /\b(photograph|photographer|photo\s*studio|photography)\b/i;

const FLORIST_KEEP_RE =
  /\b(florist|flower\s*shop|floral|bouquet|flowers?\s*(?:and|&)\s*gifts?)\b/i;

const SPA_PRIMARY_RE =
  /\b(spa|massage|day\s*spa|wellness)\b/i;

function normalizeVerticalHint(
  raw: string | null | undefined,
  facetHay: string,
): string | null {
  if (typeof raw === "string" && raw.trim()) {
    const hint = raw.trim().toLowerCase();
    const aliased = HINT_ALIASES[hint] ?? hint;
    if (policyForHint(aliased)) return aliased;
  }
  // Dining / drinks wording wins over scenic tokens like "sea view".
  if (
    /restaurant|dinner|dining|brunch|cocktail|bar|wine|meal|lunch|cafe|bistro/i.test(
      facetHay,
    )
  ) {
    if (/cocktail|bar|drinks|nightlife|wine/i.test(facetHay)) return "bars";
    return "restaurants";
  }
  if (PHOTO_FACET_RE.test(facetHay)) return "photography";
  if (FLORIST_FACET_RE.test(facetHay)) return "florists";
  if (/\b(spa|massage|wellness|pamper|day\s*spa)\b/i.test(facetHay)) {
    return "spas";
  }
  if (/\b(golf|horse\s*trails?|kayak|surf|outdoor\s*activit)\b/i.test(facetHay)) {
    return "attractions";
  }
  // Default scenic/backdrop facets to attractions when the planner omitted a hint.
  if (SCENIC_FACET_RE.test(facetHay)) {
    return "attractions";
  }
  return null;
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

    const verticalHint = normalizeVerticalHint(
      typeof raw.verticalHint === "string" ? raw.verticalHint : null,
      `${id} ${label} ${searchQuery}`,
    );

    const searchConcepts = Array.isArray(raw.searchConcepts)
      ? raw.searchConcepts
          .filter((c): c is string => typeof c === "string")
          .map((c) => c.trim().slice(0, 160))
          .filter(Boolean)
          .slice(0, 8)
      : undefined;

    out.push({
      id,
      label,
      searchQuery,
      verticalHint,
      ...(searchConcepts && searchConcepts.length > 0
        ? { searchConcepts }
        : {}),
    });
  }

  return out;
}

/** SA casual / QSR brands wrong for elevated adult celebrations. */
export const ELEVATED_CASUAL_CHAIN_RE =
  /\b(steers|rocomamas|rocomama'?s|mcdonald'?s|kfc|burger\s*king|debonairs|fishaways|nando'?s|chicken\s*licken|spur\s*steak|wimpy|ocean\s*basket|simply\s*asia|mugg\s*&\s*bean|seattle\s*coffee|vidi'?s|pedros|pedro'?s|bird\s*&\s*co|bird\s*and\s*co|mozambik|tiger'?s?\s*milk|skippies)\b/i;

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

function facetKind(
  facet: PlanFacet,
):
  | "dining"
  | "photography"
  | "florist"
  | "jewellery"
  | "stay"
  | "scenic"
  | "spa"
  | "other" {
  if (isDiningPlanFacet(facet)) return "dining";
  const hay = facetHay(facet);
  if (
    facet.verticalHint === "photography" ||
    PHOTO_FACET_RE.test(hay)
  ) {
    return "photography";
  }
  if (facet.verticalHint === "florists" || FLORIST_FACET_RE.test(hay)) {
    return "florist";
  }
  if (
    facet.verticalHint === "jewellery" ||
    /jewell|engagement\s*ring|diamond/i.test(hay)
  ) {
    return "jewellery";
  }
  if (
    facet.verticalHint === "hotels" ||
    /\b(hotel|overnight|stay|suite|accommodation)\b/i.test(hay)
  ) {
    return "stay";
  }
  if (facet.verticalHint === "spas" || SPA_PRIMARY_RE.test(hay)) {
    return "spa";
  }
  if (
    facet.verticalHint === "attractions" ||
    facet.verticalHint === "family" ||
    facet.verticalHint === "fitness" ||
    facet.verticalHint === "golf" ||
    SCENIC_FACET_RE.test(hay)
  ) {
    return "scenic";
  }
  return "other";
}

/**
 * Hard per-facet fit: drop funeral/legal/property/trades junk and spas from
 * dinner; require photographer/florist shape for those sections; keep scenic
 * free of accommodation and spa-as-primary padding.
 * Prefer empty section over wrong filler.
 */
export function filterPlanFacetVerticalFit(
  businesses: BusinessResult[],
  facets: PlanFacet[],
): BusinessResult[] {
  if (facets.length === 0) return businesses;
  const byId = new Map(facets.map((f) => [f.id, f]));

  return businesses.filter((b) => {
    const facetId = getPlanFacetId(b);
    if (!facetId) return true;
    const facet = byId.get(facetId);
    if (!facet) return true;

    const kind = facetKind(facet);
    const verts = verticalsFromMetadata(b.metadata);
    const hay = haystack(b);

    // Stay facets intentionally include hotels / guest houses.
    if (kind !== "stay" && FACET_JUNK_RE.test(hay)) return false;
    if (
      kind !== "stay" &&
      verts.some((v) =>
        [
          "funeral",
          "legal",
          "property",
          "handyman",
          "employment",
          "furniture",
          "blinds-flooring",
          "architects",
          "contractors",
          "travel",
        ].includes(v),
      )
    ) {
      return false;
    }

    // Vague leisure / gentlemen's / activities facets — drop malls, retail, cleaning.
    if (kind === "other") {
      if (LEISURE_JUNK_RE.test(hay)) return false;
      if (verts.some((v) => LEISURE_JUNK_VERTICALS.has(v))) return false;
      if (LEISURE_KEEP_VERTICALS.has(verts[0] ?? "") || verts.some((v) => LEISURE_KEEP_VERTICALS.has(v))) {
        return true;
      }
      if (LEISURE_KEEP_RE.test(hay)) return true;
      if (/\b(mall|shopping|store|warehouse|clothing|clean(?:ing)?)\b/i.test(hay)) {
        return false;
      }
      // Prefer empty over retail/service filler for vague activity sections.
      return false;
    }

    if (kind === "spa") {
      if (LEISURE_JUNK_RE.test(hay)) return false;
      if (verts.some((v) => LEISURE_JUNK_VERTICALS.has(v))) return false;
      if (verts.includes("spas") || SPA_PRIMARY_RE.test(hay)) return true;
      if (facet.verticalHint === "spas") {
        return matchesVerticalHint(b, "spas");
      }
      return false;
    }

    if (kind === "dining") {
      if (verts.includes("spas") || SPA_PRIMARY_RE.test(b.category ?? "")) {
        return false;
      }
      return isDiningBusiness(b);
    }

    if (kind === "photography") {
      if (verts.includes("photography") || PHOTO_KEEP_RE.test(hay)) return true;
      if (facet.verticalHint === "photography") {
        return matchesVerticalHint(b, "photography");
      }
      return false;
    }

    if (kind === "florist") {
      if (verts.includes("florists") || FLORIST_KEEP_RE.test(hay)) return true;
      if (facet.verticalHint === "florists") {
        return matchesVerticalHint(b, "florists");
      }
      return false;
    }

    if (kind === "jewellery") {
      if (verts.includes("jewellery") || JEWELLERY_NOISE_RE.test(hay)) {
        return true;
      }
      if (facet.verticalHint === "jewellery") {
        return matchesVerticalHint(b, "jewellery");
      }
      return false;
    }

    if (kind === "stay") {
      if (verts.includes("hotels")) return true;
      if (/\b(hotel|guest\s*house|guesthouse|boutique\s*hotel|suite|lodge)\b/i.test(hay)) {
        return true;
      }
      if (facet.verticalHint === "hotels") {
        return matchesVerticalHint(b, "hotels");
      }
      return false;
    }

    // scenic / outdoors
    if (verts.includes("spas") || SPA_PRIMARY_RE.test(hay)) return false;
    if (verts.includes("hotels") || verts.includes("travel")) return false;
    if (LEISURE_JUNK_RE.test(hay)) return false;
    if (verts.some((v) => LEISURE_JUNK_VERTICALS.has(v))) return false;
    if (/\b(travel\s*agency|accommodation|guest\s*house|guesthouse|hotel|lodging)\b/i.test(hay)) {
      return false;
    }
    if (facet.verticalHint) {
      return matchesVerticalHint(b, facet.verticalHint);
    }
    return (
      matchesVerticalHint(b, "attractions") ||
      matchesVerticalHint(b, "fitness") ||
      LEISURE_KEEP_RE.test(hay)
    );
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
    facet.verticalHint === "bars" ||
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

const DEFAULT_PROPOSAL_FACETS: PlanFacet[] = [
  {
    id: "rings",
    label: "Engagement rings",
    searchQuery: "engagement rings jewellers Ballito",
    verticalHint: "jewellery",
  },
  {
    id: "flowers",
    label: "Proposal florist",
    searchQuery: "florist bouquet proposal flowers Ballito",
    verticalHint: "florists",
  },
  {
    id: "proposal_spot",
    label: "Proposal spot",
    searchQuery: "scenic beach viewpoint proposal spot sea view Ballito",
    verticalHint: "attractions",
  },
  {
    id: "photographer",
    label: "Photographer",
    searchQuery: "engagement photographer proposal photography Ballito",
    verticalHint: "photography",
  },
  {
    id: "romantic_dinner",
    label: "Romantic dinner",
    searchQuery: "romantic fine dining sea view restaurant Ballito",
    verticalHint: "restaurants",
  },
  {
    id: "overnight",
    label: "Overnight stay",
    searchQuery: "romantic boutique hotel suite Ballito",
    verticalHint: "hotels",
  },
];

/**
 * Ensure proposal days cover rings, flowers, spot, photographer, dinner, stay —
 * not just whatever thin pair the planner LLM returned.
 */
export function enrichProposalFacets(
  facets: PlanFacet[],
  _text: string,
): PlanFacet[] {
  let out = sanitizePlanFacets(facets);
  if (out.length === 0) {
    return DEFAULT_PROPOSAL_FACETS.map((f) => ({ ...f }));
  }

  const ensure = (facet: PlanFacet, match: RegExp) => {
    if (hasFacetMatching(out, match) || out.length >= MAX_FACETS) return;
    out.push({ ...facet });
  };

  ensure(DEFAULT_PROPOSAL_FACETS[0]!, /jewell|ring|diamond/i);
  ensure(DEFAULT_PROPOSAL_FACETS[1]!, /florist|flower|bouquet|floral/i);
  ensure(DEFAULT_PROPOSAL_FACETS[2]!, SCENIC_FACET_RE);
  ensure(DEFAULT_PROPOSAL_FACETS[3]!, PHOTO_FACET_RE);
  if (!out.some(isDiningPlanFacet) && out.length < MAX_FACETS) {
    out.push({ ...DEFAULT_PROPOSAL_FACETS[4]! });
  }
  ensure(
    DEFAULT_PROPOSAL_FACETS[5]!,
    /\b(hotel|overnight|stay|suite|accommodation)\b/i,
  );

  // Prefer a full day plan order when we had to pad heavily.
  if (out.length >= 5) {
    const rank = (f: PlanFacet): number => {
      const k = facetKind(f);
      switch (k) {
        case "jewellery":
          return 0;
        case "florist":
          return 1;
        case "scenic":
          return 2;
        case "photography":
          return 3;
        case "dining":
          return 4;
        case "stay":
          return 5;
        default:
          return 6;
      }
    };
    out = [...out].sort((a, b) => rank(a) - rank(b));
  }

  return sanitizePlanFacets(out);
}

/**
 * Keep celebration plans broad and on-tone.
 * Adult milestones must not keep kids/family dinner facets (Steers path).
 * Adult downtime (kids-free day) rewrites to spa / quiet dining / outdoors.
 * Proposals get a full service checklist when the LLM under-delivers.
 */
export function enrichCelebrationFacets(
  facets: PlanFacet[],
  text: string,
): PlanFacet[] {
  if (isAdultDowntimeAsk(text)) {
    return enrichAdultDowntimeFacets(facets, text);
  }

  if (isProposalAsk(text)) {
    return enrichProposalFacets(facets, text);
  }

  let out = sanitizePlanFacets(facets);
  if (out.length === 0) return out;
  if (isKidsCelebrationAsk(text)) return out;

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
        verticalHint: drinks.verticalHint ?? "bars",
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

const DEFAULT_ADULT_DOWNTIME_FACETS: PlanFacet[] = [
  {
    id: "spa_unwind",
    label: "Spa & unwind",
    searchQuery: "day spa massage wellness Ballito",
    verticalHint: "spas",
  },
  {
    id: "quiet_dining",
    label: "Quiet dining",
    searchQuery: "quiet restaurant adult dining sea view Ballito",
    verticalHint: "restaurants",
  },
  {
    id: "outdoors",
    label: "Outdoors & golf",
    searchQuery: "golf course horse trails outdoor activity Ballito",
    verticalHint: "attractions",
  },
];

/**
 * Rewrite planner facets for kids-free / spouse day-off asks.
 * Stops celebration framing and shopping/mall "gentlemen's activities" junk.
 */
export function enrichAdultDowntimeFacets(
  facets: PlanFacet[],
  text: string,
): PlanFacet[] {
  const sanitized = sanitizePlanFacets(facets);
  if (sanitized.length === 0) {
    return DEFAULT_ADULT_DOWNTIME_FACETS.map((f) => ({ ...f }));
  }

  const rewritten = sanitized.map((f) => {
    const hay = facetHay(f);
    if (
      /relax|spa|massage|pamper|wellness|unwind|treat/i.test(hay) ||
      f.verticalHint === "spas"
    ) {
      return {
        id: f.id.includes("spa") || f.id.includes("relax") ? f.id : "spa_unwind",
        label: /spa|massage|relax|unwind/i.test(f.label)
          ? f.label
          : "Spa & unwind",
        searchQuery: /spa|massage|wellness/i.test(f.searchQuery)
          ? f.searchQuery
          : "day spa massage wellness Ballito",
        verticalHint: "spas" as string | null,
      };
    }
    if (isDiningPlanFacet(f) || /quiet|dining|restaurant|lunch|brunch|meal|cafe|coffee/i.test(hay)) {
      return {
        id:
          f.id.includes("dining") || f.id.includes("restaurant") || f.id.includes("quiet")
            ? f.id
            : "quiet_dining",
        label: /quiet|dining|restaurant/i.test(f.label)
          ? f.label.replace(/\bfamily\b/gi, "Quiet").trim() || "Quiet dining"
          : "Quiet dining",
        searchQuery:
          "quiet restaurant adult dining sea view Ballito",
        verticalHint: "restaurants" as string | null,
      };
    }
    // Gentlemen's / active / outdoor / hobby — never shopping malls.
    if (
      /gentlemen|active|outdoor|golf|fitness|sport|hobby|adventure|horse|gym|trail/i.test(
        hay,
      ) ||
      f.verticalHint === "attractions" ||
      f.verticalHint === "fitness" ||
      f.verticalHint === "golf"
    ) {
      return {
        id: f.id.includes("outdoor") || f.id.includes("golf") || f.id.includes("active")
          ? f.id
          : "outdoors",
        label: /golf|outdoor|horse|fitness|gym/i.test(f.label)
          ? f.label
          : "Outdoors & golf",
        searchQuery: /golf|horse|trail|outdoor|fitness/i.test(f.searchQuery)
          ? f.searchQuery
          : "golf course horse trails outdoor activity Ballito",
        verticalHint: "attractions" as string | null,
      };
    }
    return f;
  });

  let out = sanitizePlanFacets(rewritten);

  // Ensure spa + quiet dining + outdoors coverage when the LLM only partially matched.
  if (!hasFacetMatching(out, /spa|massage|wellness|unwind/i) && out.length < MAX_FACETS) {
    out.unshift({ ...DEFAULT_ADULT_DOWNTIME_FACETS[0]! });
  }
  if (!out.some(isDiningPlanFacet) && out.length < MAX_FACETS) {
    out.push({ ...DEFAULT_ADULT_DOWNTIME_FACETS[1]! });
  }
  if (
    !hasFacetMatching(out, /golf|outdoor|horse|trail|fitness|gym|adventure/i) &&
    out.length < MAX_FACETS
  ) {
    out.push({ ...DEFAULT_ADULT_DOWNTIME_FACETS[2]! });
  }

  // Cap at 3 focused sections for downtime (not a 6-section party plan).
  return sanitizePlanFacets(out).slice(0, 3);
}

/** Build execution steps from planner facets (one search per facet). */
export function executionPlanFromFacets(facets: PlanFacet[]): ExecutionStep[] {
  const steps: ExecutionStep[] = [];
  let priority = 1;
  for (const facet of facets) {
    const concepts =
      facet.searchConcepts && facet.searchConcepts.length > 0
        ? facet.searchConcepts
        : [facet.searchQuery];
    for (let ci = 0; ci < concepts.length; ci += 1) {
      const query = concepts[ci]?.trim();
      if (!query) continue;
      steps.push({
        id: concepts.length > 1 ? `${facet.id}_c${ci}` : facet.id,
        capability: "business_search" as const,
        type: "business_search" as const,
        query,
        params: {
          limit: isDiningPlanFacet(facet)
            ? DINING_FACET_SEARCH_LIMIT
            : FACET_SEARCH_LIMIT,
          ...(facet.verticalHint ? { verticalHint: facet.verticalHint } : {}),
          planFacetId: facet.id,
          planFacetLabel: facet.label,
          searchConcept: query,
        },
        priority,
        optional: true,
      });
      priority += 1;
    }
  }
  return steps;
}

/** Soft title from ask + goal — not a fixed proposal string. */
export function celebrationTitleHint(
  text: string,
  goalDescription?: string,
  goalPrimary?: string,
): string {
  if (isAdultDowntimeAsk(text)) {
    if (/\bhusband\b/i.test(text)) return "A day off for him";
    if (/\bwife\b/i.test(text)) return "A day off for her";
    if (/\b(partner|spouse)\b/i.test(text)) return "A day off together";
    return "A day without the kids";
  }
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
    adultDowntime?: boolean;
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
  const downtimeLean = opts.adultDowntime === true;
  const allowJewellery = facetTargetsJewellery(opts.facets);
  const allowKidsPlay =
    facetTargetsKidsPlay(opts.facets) || (familyLean && !downtimeLean);

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

    if ((romanticLean || downtimeLean) && !allowKidsPlay && !familyLean) {
      if (KIDS_PLAY_RE.test(hay)) return false;
    }

    if (downtimeLean) {
      if (LEISURE_JUNK_RE.test(hay)) return false;
      if (verts.some((v) => LEISURE_JUNK_VERTICALS.has(v))) return false;
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
