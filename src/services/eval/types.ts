/**
 * Gold-standard evaluation question types.
 * Dataset JSON lives in evals/gold/questions.json (git source of truth).
 */

export type GoldIntent =
  | "BUSINESS_SEARCH"
  | "DISCOVERY"
  | "EMERGENCY"
  | "NAVIGATION"
  | "EVENT_SEARCH"
  | "ACCOMMODATION"
  | "CONVERSATION"
  | "PLANNING"
  | "COMPARISON"
  | "LIVE_INFORMATION"
  | "PLACE_SEARCH"
  | "FACT";

export type LabelingTier = "full" | "intent";

export type GoldQuestion = {
  id: string;
  query: string;
  city: string;
  intent: GoldIntent;
  expectEntityType?: string;
  expectVertical?: string;
  expectTop1Ids?: string[];
  expectTop3Ids?: string[];
  expectKnowledgeCard?: string | null;
  expectCapabilities?: string[];
  expectSearchFilters?: Record<string, unknown>;
  requireLlm: boolean;
  requireSql: boolean;
  requireSearch: boolean;
  requireKnowledgeCard: boolean;
  labelingTier: LabelingTier;
  notes?: string;
};

export type GoldDataset = {
  version: number;
  description: string;
  questions: GoldQuestion[];
};

export function isGoldQuestion(value: unknown): value is GoldQuestion {
  if (!value || typeof value !== "object") return false;
  const q = value as Record<string, unknown>;
  return (
    typeof q.id === "string" &&
    typeof q.query === "string" &&
    typeof q.city === "string" &&
    typeof q.intent === "string" &&
    typeof q.requireLlm === "boolean" &&
    typeof q.requireSql === "boolean" &&
    typeof q.requireSearch === "boolean" &&
    typeof q.requireKnowledgeCard === "boolean" &&
    (q.labelingTier === "full" || q.labelingTier === "intent")
  );
}
