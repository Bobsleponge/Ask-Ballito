/**
 * Knowledge Pipeline stage contracts.
 * Offline only — never invoke enrichment stages from the ask path.
 */

export type PipelineStageId =
  | "clean"
  | "normalize"
  | "dedup"
  | "extract_metadata"
  | "classify_taxonomy"
  | "discover_relations"
  | "score_confidence"
  | "upsert_store"
  | "refresh_indexes"
  | "refresh_cards";

export interface PipelineContext {
  citySlug: string;
  dryRun?: boolean;
  /** When true, LLM extract stages may run (batch jobs only). */
  allowLlm?: boolean;
}

export interface PipelineStageResult {
  stage: PipelineStageId;
  ok: boolean;
  processed: number;
  skipped: number;
  errors: string[];
  meta?: Record<string, unknown>;
}

export interface PipelineRunResult {
  citySlug: string;
  stages: PipelineStageResult[];
  startedAt: string;
  finishedAt: string;
}
