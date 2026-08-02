import "server-only";
import { zodTextFormat } from "openai/helpers/zod";
import { openai, AI_MODEL } from "@/lib/ai/openai";
import { logAiCall } from "@/lib/ai/logging";
import { promptVersion } from "@/lib/ai/prompts";
import {
  queryIntelligenceResultSchema,
  buildQueryIntelligenceSystem,
  type QueryIntelligenceResult,
} from "@/lib/ai/prompts/query-intelligence.v1";
import { wrapUserContent, mapHistoryToModelTurns } from "@/lib/ai/safety";
import type { ConversationContext, PlannerDraft } from "./types";
import { FALLBACK_DRAFT, emptyConstraintFlags, emptyEntityModel } from "./types";
import {
  getCachedPlannerDraft,
  hashStickyPayload,
  plannerCacheKey,
  setCachedPlannerDraft,
} from "./planner-cache";
import { queryIntelligenceToDraft } from "./qi-to-draft";

export interface QueryIntelligenceParams {
  context: ConversationContext;
  message: string;
  userId?: string | null;
  conversationId?: string | null;
}

function stickySnapshot(context: ConversationContext): string {
  const e = context.stickyEntities;
  const c = context.stickyConstraints;
  const parts = [
    e.locations.length ? `locations=${e.locations.join(", ")}` : "",
    e.estates.length ? `estates=${e.estates.join(", ")}` : "",
    e.landmarks.length ? `landmarks=${e.landmarks.join(", ")}` : "",
    e.cuisines.length ? `cuisines=${e.cuisines.join(", ")}` : "",
  ].filter(Boolean);
  const constraintParts = [
    c.openNow != null ? `openNow=${c.openNow}` : "",
    c.budget ? `budget=${c.budget}` : "",
    c.partySize != null ? `partySize=${c.partySize}` : "",
    c.distanceLabel ? `distance=${c.distanceLabel}` : "",
  ].filter(Boolean);
  return [
    parts.length
      ? `Sticky geo/entities: ${parts.join("; ")}`
      : "Sticky geo/entities: (none)",
    constraintParts.length
      ? `Sticky constraints: ${constraintParts.join("; ")}`
      : "Sticky constraints: (none)",
    context.history.length > 0
      ? `Follow-up (${context.history.length} prior turns). Carry forward goal/place/constraints unless topic changes.`
      : "First turn.",
  ].join("\n");
}

function fallbackQi(message: string): QueryIntelligenceResult {
  return {
    goal: {
      primary: "fallback",
      description: message.slice(0, 200) || "Continue",
    },
    domains: ["unknown"],
    entities: emptyEntityModel(),
    explicitConstraints: emptyConstraintFlags(),
    implicitPreferences: emptyConstraintFlags(),
    explicitEnvironment: null,
    implicitEnvironment: null,
    hardExclusions: [],
    softPreferences: [],
    audience: "unknown",
    locationIntent: { kind: "unspecified", labels: [] },
    temporalIntent: { openNow: null, meal: null, when: null },
    desiredResultType: "ranked_list",
    facets: [],
    searchConcepts: message.trim() ? [message.slice(0, 120)] : [],
    diversityRequirements: {
      minDistinctConcepts: 0,
      avoidNearDuplicates: true,
    },
    grouping: { strategy: "none", sectionLabels: [] },
    needsClarification: false,
    clarificationQuestion: null,
    confidence: 0.25,
    candidateWorkflows: ["general"],
  };
}

/**
 * Cheap structured LLM understanding for non-trivial natural-language asks.
 * Does not recommend businesses or invent local facts.
 */
export class QueryIntelligenceService {
  async understand(params: QueryIntelligenceParams): Promise<{
    result: QueryIntelligenceResult;
    draft: PlannerDraft;
  }> {
    const { context, message, userId, conversationId } = params;
    const start = Date.now();

    const cacheKey = plannerCacheKey({
      citySlug: context.city.slug,
      message: `qi:v1:${message}`,
      stickyHash: hashStickyPayload({
        entities: context.stickyEntities,
        constraints: context.stickyConstraints,
      }),
    });
    const cached = await getCachedPlannerDraft(cacheKey);
    if (cached && isQiDraftNotes(cached.notes)) {
      await logAiCall({
        service: "QueryIntelligenceService",
        promptVersion: promptVersion("query_intelligence_v1"),
        model: AI_MODEL,
        input: { message, cache: "hit" },
        output: cached,
        latencyMs: Date.now() - start,
        status: "success",
        userId,
        conversationId,
      });
      return {
        result: draftToApproxQi(cached, message),
        draft: cached,
      };
    }

    const input = [
      {
        role: "system" as const,
        content: buildQueryIntelligenceSystem(context.city.name),
      },
      { role: "system" as const, content: stickySnapshot(context) },
      ...mapHistoryToModelTurns(context.history.slice(-6)),
      { role: "user" as const, content: wrapUserContent(message) },
    ];

    try {
      const res = await openai.responses.parse({
        model: AI_MODEL,
        input,
        text: {
          format: zodTextFormat(
            queryIntelligenceResultSchema,
            "query_intelligence",
          ),
        },
      });

      const parsed =
        (res.output_parsed as QueryIntelligenceResult | null) ??
        fallbackQi(message);
      const { draft } = queryIntelligenceToDraft(parsed, message);
      await setCachedPlannerDraft(cacheKey, draft);

      await logAiCall({
        service: "QueryIntelligenceService",
        promptVersion: promptVersion("query_intelligence_v1"),
        model: AI_MODEL,
        input: { message, cache: "miss" },
        output: draft,
        inputTokens: res.usage?.input_tokens ?? null,
        outputTokens: res.usage?.output_tokens ?? null,
        latencyMs: Date.now() - start,
        status: "success",
        userId,
        conversationId,
      });

      return { result: parsed, draft };
    } catch (err) {
      await logAiCall({
        service: "QueryIntelligenceService",
        promptVersion: promptVersion("query_intelligence_v1"),
        model: AI_MODEL,
        input: { message },
        latencyMs: Date.now() - start,
        status: "error",
        error: err instanceof Error ? err.message : String(err),
        userId,
        conversationId,
      });
      const fb = fallbackQi(message);
      const { draft } = queryIntelligenceToDraft(fb, message);
      draft.notes = `qi:v1|error=1|${draft.notes ?? ""}`;
      return { result: fb, draft };
    }
  }
}

function isQiDraftNotes(notes: string | null): boolean {
  return typeof notes === "string" && notes.startsWith("qi:");
}

/** Best-effort reverse map for cache hits (draft already adapted). */
function draftToApproxQi(
  draft: PlannerDraft,
  message: string,
): QueryIntelligenceResult {
  const fb = fallbackQi(message);
  return {
    ...fb,
    goal: draft.goal,
    confidence: draft.confidence,
    candidateWorkflows:
      draft.candidateWorkflows.length > 0
        ? draft.candidateWorkflows
        : fb.candidateWorkflows,
    entities: draft.entities,
    explicitConstraints: draft.constraints.required,
    implicitPreferences: draft.constraints.preferred,
    hardExclusions: draft.hardExclusions ?? [],
    searchConcepts: draft.searchConcepts ?? draft.draftQueries,
    facets: draft.planFacets.map((f) => ({
      id: f.id,
      label: f.label,
      need: f.label,
      searchConcepts: f.searchConcepts?.length
        ? f.searchConcepts
        : [f.searchQuery],
      entityKinds: ["business" as const],
      verticalHint: f.verticalHint,
      hard: true,
    })),
  };
}

export const queryIntelligenceService = new QueryIntelligenceService();
