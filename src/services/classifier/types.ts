import type { QueryClass } from "@/services/routing/types";
import type { WorkflowId } from "@/services/planner/types";

export interface ClassificationResult {
  queryClass: QueryClass;
  confidence: number;
  signals: string[];
  /** Suggested workflow when short-circuiting the extractor. */
  suggestedWorkflow: WorkflowId;
  /** Search queries to seed the execution plan. */
  draftQueries: string[];
  /** Vertical / business-type hints. */
  businessTypes: string[];
  cuisines: string[];
  /** Whether this class should skip LLM narration when results exist. */
  preferDeterministicNarration: boolean;
  /** Whether this class can skip the LLM extractor at high confidence. */
  canSkipExtractor: boolean;
}

export const CHEAP_QUERY_CLASSES: ReadonlySet<QueryClass> = new Set([
  "FACT",
  "BUSINESS_SEARCH",
  "EVENT_SEARCH",
  "PLACE_SEARCH",
  "DISCOVERY",
  "LIVE_INFORMATION",
]);

export const EXPENSIVE_QUERY_CLASSES: ReadonlySet<QueryClass> = new Set([
  "COMPARISON",
  "PLANNING",
  "CONVERSATION",
]);
