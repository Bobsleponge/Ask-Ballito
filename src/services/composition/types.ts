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
}

export interface ExperienceSection {
  id: string;
  title: string;
  subtitle: string | null;
  kind: SectionKind;
  /** Refs into composition.businesses */
  businessIds: string[];
}

/** Post-rank artifact for prompts + SSE + UI. */
export interface ExperienceComposition {
  strategy: PresentationStrategy;
  title: string | null;
  sections: ExperienceSection[];
  /** Deduped catalog; presentation order lives in sections. */
  businesses: BusinessResult[];
}

/** Wire/UI payload without repeating the business catalog. */
export type CompositionPayload = Pick<
  ExperienceComposition,
  "strategy" | "title" | "sections"
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

/** Hard cap across all sections for a single reply. */
export const MAX_COMPOSITION_BUSINESSES = 12;

export function defaultCompositionRequest(
  strategy: PresentationStrategy = "ranked_list",
): CompositionRequest {
  return {
    strategy,
    titleHint: null,
    maxSections: 4,
    maxItemsPerSection: 4,
    sectionHints: [],
  };
}
