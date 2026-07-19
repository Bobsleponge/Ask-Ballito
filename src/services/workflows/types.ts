import type { PlannerResult } from "@/lib/ai/prompts/planner.v1";
import type { PromptName } from "@/lib/ai/prompts";
import type { City } from "@/config/cities";
import type { BusinessResult } from "@/lib/schemas/business";
import type { RankConfig } from "@/services/ai/ranking.engine";

/** Runtime workflow ids including emergency (not a planner enum value). */
export type RuntimeWorkflowId =
  | PlannerResult["workflow"]
  | "emergency";

export interface SearchStrategy {
  queries: string[];
  limitPerQuery: number;
}

export interface WorkflowContext {
  city: City;
  message: string;
  plan: PlannerResult;
}

export interface Workflow {
  id: RuntimeWorkflowId;
  /** Return human-readable missing pieces; empty if enough to proceed. */
  requiredFields: (plan: PlannerResult) => string[];
  clarificationMessage: (plan: PlannerResult) => string;
  searchStrategy: (plan: PlannerResult) => SearchStrategy;
  rankConfig: Partial<RankConfig>;
  /** Return a fixed answer to skip the explanation LLM; null to continue. */
  fastPath?: (ctx: WorkflowContext) => string | null;
  promptName: PromptName;
  buildSystemPrompt: (cityName: string) => string;
}

export interface OrchestrationTrace {
  plan: PlannerResult;
  workflowId: RuntimeWorkflowId;
  clarification: boolean;
  searchQueries: string[];
  retrievedIds: string[];
  ranking: { id: string; name: string; score: number }[];
  llmInvoked: boolean;
  latencyMs: number;
  businesses: BusinessResult[];
  text?: string;
}
