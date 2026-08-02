import {
  SOURCE_CONFIDENCE,
  type FactSource,
  type FieldMetaMap,
  setFieldMeta,
} from "@/lib/knowledge/field-meta";
import type { PipelineStageResult } from "./types";

/**
 * Apply source confidence policy to a set of fields.
 * Pure function — no I/O.
 */
export function scoreFields(
  meta: FieldMetaMap,
  fields: Array<{ field: string; source: FactSource }>,
): FieldMetaMap {
  let next = { ...meta };
  for (const { field, source } of fields) {
    next = setFieldMeta(next, field, source, {
      confidence: SOURCE_CONFIDENCE[source],
    });
  }
  return next;
}

export function runConfidenceStage(opts: {
  annotated: number;
}): PipelineStageResult {
  return {
    stage: "score_confidence",
    ok: true,
    processed: opts.annotated,
    skipped: 0,
    errors: [],
  };
}
