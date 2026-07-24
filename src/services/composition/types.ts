import type { BusinessResult } from "@/lib/schemas/business";

export type PresentationStrategy =
  | "ranked_list"
  | "grouped_sections"
  | "comparison"
  | "itinerary"
  | "nearest_first";

export type SectionKind = "list" | "compare_column" | "itinerary_step" | "nearest";

export interface SectionHint {
  id: string;
  title: string;
  kind: SectionKind;
  match?: {
    categories?: string[];
    cuisines?: string[];
    priceBand?: string;
  };
}

/** Planner request — strategy + packing hints (no businesses yet). */
export interface CompositionRequest {
  strategy: PresentationStrategy;
  titleHint: string | null;
  maxSections: number;
  maxItemsPerSection: number;
  sectionHints: SectionHint[];
  /** How to bucket businesses for grouped_sections. */
  bucketProfile?: "activities" | "special_occasion" | "plan_facets" | "default";
  /**
   * Dynamic celebration facets (section titles + matching). Used when
   * bucketProfile is plan_facets.
   */
  planFacets?: Array<{
    id: string;
    label: string;
    searchQuery: string;
    verticalHint: string | null;
  }>;
  /** When true (rainy weather), push beaches / outdoor sections later. */
  preferIndoorDueToWeather?: boolean;
  /** When true (sunny / dry), lead with sea-view / outdoor sections. */
  preferOutdoorDueToWeather?: boolean;
  /** Soft weather lean for ranking — prioritize, never hard-filter. */
  weatherBias?: "favor_outdoor" | "favor_indoor" | "neutral" | null;
}

export interface ExperienceSection {
  id: string;
  title: string;
  subtitle: string | null;
  kind: SectionKind;
  /** Refs into composition.businesses */
  businessIds: string[];
}

/** How tightly results match the user's ask. */
export type CompositionGroundingMode = "exact" | "related";

export interface CompositionGrounding {
  mode: CompositionGroundingMode;
  /** Niche service the user asked for (e.g. "ombre"). */
  requestedService: string;
  /** Short note for prompts / UI. */
  note: string;
}

/** Post-rank artifact for prompts + SSE + UI. */
export interface ExperienceComposition {
  strategy: PresentationStrategy;
  title: string | null;
  sections: ExperienceSection[];
  /** Deduped catalog; presentation order lives in sections. */
  businesses: BusinessResult[];
  /** Present when results are related near-misses rather than exact matches. */
  grounding?: CompositionGrounding;
}

/** Wire/UI payload without repeating the business catalog. */
export type CompositionPayload = Pick<
  ExperienceComposition,
  "strategy" | "title" | "sections" | "grounding"
>;

export function emptyComposition(
  strategy: PresentationStrategy = "ranked_list",
): ExperienceComposition {
  return {
    strategy,
    title: null,
    sections: [],
    businesses: [],
  };
}

/** Attach grounding on a composition (immutable). */
export function withCompositionGrounding(
  composition: ExperienceComposition,
  grounding: CompositionGrounding,
): ExperienceComposition {
  return { ...composition, grounding };
}

/** Hard ceiling across all sections for a single reply (not a fill target). */
export const MAX_COMPOSITION_BUSINESSES = 25;

export function defaultCompositionRequest(
  strategy: PresentationStrategy = "ranked_list",
): CompositionRequest {
  return {
    strategy,
    titleHint: null,
    maxSections: 5,
    maxItemsPerSection: 5,
    sectionHints: [],
  };
}
