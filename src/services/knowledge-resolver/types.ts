import type { City } from "@/config/cities";
import type { BusinessResult } from "@/lib/schemas/business";
import type { ClassificationResult } from "@/services/classifier/types";
import type { ExperienceComposition } from "@/services/composition";
import type { ConversationContext, PlannerPlan } from "@/services/planner/types";

export type ResolutionType =
  | "FACT"
  | "SEARCH"
  | "KNOWLEDGE_CARD"
  | "CACHE"
  | "SQL"
  | "LIVE_DATA"
  | "AI_REQUIRED"
  | "UNKNOWN";

export type NextStage = "return" | "search" | "continue";

export interface KnowledgeResolution {
  type: ResolutionType;
  answered: boolean;
  confidence: number;
  reason: string;
  sources: string[];
  nextStage: NextStage;
  expectedCost: "none" | "low";
  expectedLatencyMs: number;
  pluginId: string;
  text?: string;
  businesses?: BusinessResult[];
  composition?: ExperienceComposition | null;
  /** Optional plan override when the plugin already built one (e.g. cards). */
  plan?: PlannerPlan;
  /** Hints when answered=false but resolver can help downstream. */
  draftQueries?: string[];
  signals?: string[];
}

export interface KnowledgeResolverInput {
  message: string;
  city: City;
  classification: ClassificationResult;
  context: ConversationContext;
  excludeBusinessIds: Set<string>;
  retry: boolean;
}

export interface KnowledgeResolverPlugin {
  id: string;
  resolve(input: KnowledgeResolverInput): Promise<KnowledgeResolution | null>;
}

/** Minimum confidence for an answered resolution to short-circuit. */
export const KNOWLEDGE_RESOLVER_CONFIDENCE_THRESHOLD = 0.8;
