import {
  isTrueSafetyEmergency,
  isTradeOrAfterHoursServiceAsk,
  isHumanMedicalAsk,
  isPetVetAsk,
} from "@/services/planner/emergency-guard";
import { detectTradeKind, tradeLabel, tradeSearchQueries } from "@/services/planner/trade-query";
import {
  extractProductLabel,
  isProductPurchaseAsk,
  productSearchQueries,
} from "@/services/planner/product-intent";
import {
  extractMusicLabel,
  isMusicInstrumentAsk,
  musicSearchQueries,
} from "@/services/planner/music-intent";
import {
  autoProtectionSearchQueries,
  extractAutoProtectionLabel,
  isAutoProtectionAsk,
} from "@/services/planner/auto-protection-intent";
import {
  autoPartsSearchQueries,
  extractAutoPartsLabel,
  isAutoPartsAsk,
} from "@/services/planner/auto-parts-intent";
import { isCelebrationAsk, isProposalAsk, isAdultDowntimeAsk } from "@/services/planner/special-occasion-intent";
import { matchFaq } from "@/config/local-knowledge";
import type { QueryClass } from "@/services/routing/types";
import type { WorkflowId } from "@/services/planner/types";
import type { ClassificationResult } from "./types";
import {
  BUSINESS_PATTERNS,
  COMPARISON_PATTERNS,
  CONVERSATION_PATTERNS,
  DISCOVER_PROMPT_EXACT,
  DISCOVERY_PATTERNS,
  EVENT_PATTERNS,
  FACT_PATTERNS,
  LIVE_PATTERNS,
  PLACE_PATTERNS,
  PLANNING_PATTERNS,
  type ClassPattern,
} from "./patterns";
import { CHEAP_QUERY_CLASSES, EXPENSIVE_QUERY_CLASSES } from "./types";

function normalize(message: string): string {
  return message.replace(/\s+/g, " ").trim().toLowerCase();
}

function matchFirst(
  message: string,
  patterns: ClassPattern[],
): ClassPattern | null {
  for (const p of patterns) {
    if (p.re.test(message)) return p;
  }
  return null;
}

function resultFromPattern(
  queryClass: QueryClass,
  pattern: ClassPattern,
  extraSignals: string[] = [],
): ClassificationResult {
  const workflow = (pattern.workflow ?? "general") as WorkflowId;
  const canSkip = CHEAP_QUERY_CLASSES.has(queryClass);
  const preferDet =
    queryClass === "BUSINESS_SEARCH" ||
    queryClass === "PLACE_SEARCH" ||
    queryClass === "EVENT_SEARCH" ||
    queryClass === "DISCOVERY" ||
    queryClass === "FACT" ||
    queryClass === "LIVE_INFORMATION";

  return {
    queryClass,
    confidence: pattern.confidence,
    signals: [pattern.id, ...extraSignals],
    suggestedWorkflow: workflow,
    draftQueries: pattern.queries ?? [],
    businessTypes: pattern.businessTypes ?? [],
    cuisines: pattern.cuisines ?? [],
    preferDeterministicNarration: preferDet,
    canSkipExtractor: canSkip && !EXPENSIVE_QUERY_CLASSES.has(queryClass),
  };
}

/**
 * Rules-first query classifier with confidence scores.
 * Pure / sync — no LLM, no I/O.
 */
export function classifyQuery(params: {
  message: string;
  citySlug?: string;
}): ClassificationResult {
  const raw = params.message.trim();
  const text = normalize(raw);

  if (!text) {
    return {
      queryClass: "CONVERSATION",
      confidence: 0.5,
      signals: ["empty"],
      suggestedWorkflow: "general",
      draftQueries: [],
      businessTypes: [],
      cuisines: [],
      preferDeterministicNarration: false,
      canSkipExtractor: false,
    };
  }

  // Emergency / true safety — highest priority
  if (isTrueSafetyEmergency(raw)) {
    return {
      queryClass: "FACT",
      confidence: 0.99,
      signals: ["true_safety_emergency"],
      suggestedWorkflow: "emergency",
      draftQueries: [],
      businessTypes: [],
      cuisines: [],
      preferDeterministicNarration: true,
      canSkipExtractor: true,
    };
  }

  // FAQ / product meta
  if (matchFaq(raw)) {
    return {
      queryClass: "FACT",
      confidence: 0.97,
      signals: ["faq_match"],
      suggestedWorkflow: "general",
      draftQueries: [],
      businessTypes: [],
      cuisines: [],
      preferDeterministicNarration: true,
      canSkipExtractor: true,
    };
  }

  // Exact discover card prompts
  for (const card of DISCOVER_PROMPT_EXACT) {
    if (text === card.prompt || text.includes(card.prompt)) {
      const isPlanning = card.patternId.includes("proposal");
      return {
        queryClass: isPlanning ? "PLANNING" : "DISCOVERY",
        confidence: 0.96,
        signals: [card.patternId, "discover_card"],
        suggestedWorkflow: (card.workflow ?? "general") as WorkflowId,
        draftQueries: card.queries,
        businessTypes: card.businessTypes,
        cuisines: [],
        preferDeterministicNarration: !isPlanning,
        canSkipExtractor: !isPlanning,
      };
    }
  }

  const fact = matchFirst(raw, FACT_PATTERNS);
  if (fact) return resultFromPattern("FACT", fact);

  const conv = matchFirst(raw, CONVERSATION_PATTERNS);
  if (conv) {
    return {
      ...resultFromPattern("CONVERSATION", conv),
      canSkipExtractor: false,
      preferDeterministicNarration: false,
    };
  }

  const compare = matchFirst(raw, COMPARISON_PATTERNS);
  if (compare) {
    return {
      ...resultFromPattern("COMPARISON", compare),
      canSkipExtractor: false,
      preferDeterministicNarration: false,
    };
  }

  const planning = matchFirst(raw, PLANNING_PATTERNS);
  // "wedding planner in Ballito" is a business search, not event planning.
  const looksLikeServiceLookup =
    /\b(in|near|around)\s+ballito\b/i.test(raw) &&
    !/\b(plan|help me plan|itinerary|schedule)\b/i.test(raw);
  if (
    (planning ||
      isProposalAsk(raw) ||
      isCelebrationAsk(raw) ||
      isAdultDowntimeAsk(raw)) &&
    !looksLikeServiceLookup
  ) {
    const p =
      planning ??
      ({
        id: isProposalAsk(raw)
          ? "plan_proposal"
          : isAdultDowntimeAsk(raw)
            ? "plan_adult_downtime"
            : "plan_celebration",
        re: /.*/,
        confidence: 0.9,
        workflow: "special_occasion" as const,
      } satisfies ClassPattern);
    return {
      ...resultFromPattern("PLANNING", p, [
        isProposalAsk(raw) ? "proposal" : "",
        isCelebrationAsk(raw) ? "celebration" : "",
        isAdultDowntimeAsk(raw) ? "adult_downtime" : "",
      ].filter(Boolean)),
      canSkipExtractor: false,
      preferDeterministicNarration: false,
      suggestedWorkflow: "special_occasion",
    };
  }

  const live = matchFirst(raw, LIVE_PATTERNS);
  if (live) return resultFromPattern("LIVE_INFORMATION", live);

  const event = matchFirst(raw, EVENT_PATTERNS);
  if (event) return resultFromPattern("EVENT_SEARCH", event);

  const discovery = matchFirst(raw, DISCOVERY_PATTERNS);
  if (discovery) return resultFromPattern("DISCOVERY", discovery);

  // Trades / medical / product / music — strong business search
  if (isTradeOrAfterHoursServiceAsk(raw)) {
    const kind = detectTradeKind(raw);
    const label = kind ? tradeLabel(kind) : "trade service";
    return {
      queryClass: "BUSINESS_SEARCH",
      confidence: 0.95,
      signals: ["trade", kind ?? "unknown_trade"],
      suggestedWorkflow: "services",
      draftQueries: kind
        ? tradeSearchQueries(kind, raw, "Ballito")
        : [`${label} Ballito`],
      businessTypes: kind ? [kind] : ["plumber"],
      cuisines: [],
      preferDeterministicNarration: true,
      canSkipExtractor: true,
    };
  }

  if (isPetVetAsk(raw) || isHumanMedicalAsk(raw)) {
    const vet = isPetVetAsk(raw);
    return {
      queryClass: "BUSINESS_SEARCH",
      confidence: 0.94,
      signals: [vet ? "vet" : "healthcare"],
      suggestedWorkflow: "healthcare",
      draftQueries: vet
        ? ["emergency vet Ballito", "veterinary Ballito"]
        : ["doctor Ballito", "GP Ballito", "pharmacy Ballito"],
      businessTypes: vet ? ["veterinary_care"] : ["doctor", "pharmacy"],
      cuisines: [],
      preferDeterministicNarration: true,
      canSkipExtractor: true,
    };
  }

  if (isProductPurchaseAsk(raw)) {
    const productLabel = extractProductLabel(raw);
    return {
      queryClass: "BUSINESS_SEARCH",
      confidence: 0.9,
      signals: ["product_purchase"],
      suggestedWorkflow: "services",
      draftQueries: productSearchQueries(productLabel, "Ballito"),
      businessTypes: ["electronics_store", "store"],
      cuisines: [],
      preferDeterministicNarration: true,
      canSkipExtractor: true,
    };
  }

  if (isMusicInstrumentAsk(raw)) {
    const musicLabel = extractMusicLabel(raw);
    return {
      queryClass: "BUSINESS_SEARCH",
      confidence: 0.92,
      signals: ["music_instrument"],
      suggestedWorkflow: "services",
      draftQueries: musicSearchQueries(musicLabel, "Ballito"),
      businessTypes: ["store"],
      cuisines: [],
      preferDeterministicNarration: true,
      canSkipExtractor: true,
    };
  }

  if (isAutoProtectionAsk(raw)) {
    const protectionLabel = extractAutoProtectionLabel(raw);
    return {
      queryClass: "BUSINESS_SEARCH",
      confidence: 0.93,
      signals: ["auto_protection"],
      suggestedWorkflow: "services",
      draftQueries: autoProtectionSearchQueries(protectionLabel, "Ballito"),
      businessTypes: ["automotive", "PPF", "car wrap"],
      cuisines: [],
      preferDeterministicNarration: true,
      canSkipExtractor: true,
    };
  }

  if (isAutoPartsAsk(raw)) {
    const partsLabel = extractAutoPartsLabel(raw);
    return {
      queryClass: "BUSINESS_SEARCH",
      confidence: 0.93,
      signals: ["auto_parts"],
      suggestedWorkflow: "services",
      draftQueries: autoPartsSearchQueries(partsLabel, "Ballito"),
      businessTypes: ["automotive", "auto parts", "car battery"],
      cuisines: [],
      preferDeterministicNarration: true,
      canSkipExtractor: true,
    };
  }

  const place = matchFirst(raw, PLACE_PATTERNS);
  if (place) return resultFromPattern("PLACE_SEARCH", place);

  const business = matchFirst(raw, BUSINESS_PATTERNS);
  if (business) {
    const r = resultFromPattern("BUSINESS_SEARCH", business);
    // Ensure city-scoped query seed
    if (r.draftQueries.length === 0) {
      r.draftQueries = [raw.slice(0, 120)];
    } else {
      r.draftQueries = r.draftQueries.map((q) =>
        /ballito/i.test(q) ? q : `${q} Ballito`,
      );
    }
    return r;
  }

  // Default: low-confidence conversation — extractor should run
  return {
    queryClass: "CONVERSATION",
    confidence: 0.35,
    signals: ["fallback_low_confidence"],
    suggestedWorkflow: "general",
    draftQueries: [raw.slice(0, 120)],
    businessTypes: [],
    cuisines: [],
    preferDeterministicNarration: false,
    canSkipExtractor: false,
  };
}
