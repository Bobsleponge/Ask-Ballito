import "server-only";
import { recommendationService } from "./recommendation.service";
import { rankBusinesses } from "./ranking.engine";
import { businessSearchService } from "./business-search.service";
import { explanationForWorkflow } from "./explanation-prompt-map";
import { sanitizeUserInput, sanitizeHistoryForContext, prepareHistoryForModel } from "@/lib/ai/safety";
import { logAiCall } from "@/lib/ai/logging";
import { captureAbuseEvent } from "@/lib/security/abuse-events";
import { captureServerEvent } from "@/lib/analytics/posthog-server";
import { checkNarrationGrounding } from "@/lib/chat/grounding-metrics";
import { scrubInvalidBizMarkers } from "@/lib/chat/ground-assistant-text";
import { createAdminClient } from "@/lib/supabase/admin";
import { expandRelatedServiceQueries } from "@/config/service-related-queries";
import {
  CLASSIFIER_SHORT_CIRCUIT_THRESHOLD,
  intelligenceFlags,
} from "@/config/intelligence-flags";
import { shouldShortCircuitExtractor } from "@/config/short-circuit-policy";
import { matchKnowledgeCardSeed } from "@/config/knowledge-cards";
import { findKnowledgeCard } from "@/services/knowledge/knowledge-cards.service";
import { resolveKnowledge } from "@/services/knowledge-resolver";
import type { ResolutionType } from "@/services/knowledge-resolver/types";
import { getRankConfigVersion, loadRankConfig } from "@/services/ai/rank-config";
import {
  buildConversationContext,
  parseStickySummary,
  plannerExtractorService,
  queryIntelligenceService,
  resolvePlannerPlan,
  FALLBACK_DRAFT,
  detectMealTime,
  hashStickyPayload,
  filterByHardExclusions,
  filterByHardEligibility,
  hasHardEligibilityRequirements,
  summarizeRequiredConstraints,
  type ConstraintFlags,
  type PlannerDraft,
  type PlannerPlan,
} from "@/services/planner";

function compactNonNullFlags(
  flags: ConstraintFlags,
): Record<string, boolean | string | null> {
  const out: Record<string, boolean | string | null> = {};
  for (const key of Object.keys(flags) as (keyof ConstraintFlags)[]) {
    if (flags[key] != null) out[key] = flags[key];
  }
  return out;
}
import {
  classifyQuery,
  draftFromClassification,
  resolveFromClassification,
} from "@/services/classifier";
import {
  emptyQueryTrace,
  type QueryTrace,
} from "@/services/eval/query-trace";
import {
  answerCacheKey,
  getCachedAnswer,
  setCachedAnswer,
} from "@/services/routing/answer-cache";
import {
  captureTurnRouting,
  telemetryToLogFields,
} from "@/services/routing/telemetry";
import {
  createTurnTelemetry,
  primaryRouteFromPaths,
  type RoutePath,
  type TurnTelemetry,
} from "@/services/routing/types";
import {
  composeExperience,
  emptyComposition,
  formatCompositionConversational,
  withCompositionGrounding,
  type ExperienceComposition,
} from "@/services/composition";
import { runExecutionPlan } from "@/services/capabilities";
import { getWorkflowDefinition } from "@/services/workflows/definitions";
import {
  filterByVerticalHint,
  verticalHintFromPlan,
} from "@/lib/business-vertical-filter";
import { isExactVerticalHint } from "@/config/vertical-policy";
import {
  detectTradeKind,
  filterToTradeKind,
  isUrgentTradeAsk,
  tradeSearchQueries,
} from "@/services/planner/trade-query";
import { isHumanMedicalAsk } from "@/services/planner/emergency-guard";
import {
  extractProductLabel,
  isProductPurchaseAsk,
  productEmptyMessage,
  productSearchQueries,
} from "@/services/planner/product-intent";
import {
  enforceProductAskFit,
  filterProductSpecialists,
  filterShoppingMalls,
} from "@/services/planner/shopping-relevance";
import {
  extractMusicLabel,
  filterMusicSpecialists,
  isMusicInstrumentAsk,
  musicEmptyMessage,
  musicSearchQueries,
} from "@/services/planner/music-intent";
import {
  autoProtectionEmptyMessage,
  autoProtectionSearchQueries,
  extractAutoProtectionLabel,
  filterAutoProtectionSpecialists,
  isAutoProtectionAsk,
} from "@/services/planner/auto-protection-intent";
import {
  autoPartsEmptyMessage,
  autoPartsSearchQueries,
  extractAutoPartsLabel,
  filterAutoPartsSpecialists,
  isAutoPartsAsk,
} from "@/services/planner/auto-parts-intent";
import {
  applyAskFitToComposition,
  exactNicheEmptyMessage,
  extractExactNicheLabel,
  filterByAskFit,
  isExactNicheAsk,
} from "@/services/planner/exact-niche-guard";
import {
  filterCelebrationAudienceNoise,
  filterElevatedCasualDining,
  filterPlanFacetVerticalFit,
  isAdultDowntimeAsk,
  isDiningPlanFacet,
  isElevatedCelebrationAsk,
  withPlanFacet,
} from "@/services/planner/special-occasion-intent";
import { shouldFitVerify } from "@/services/ai/fit-verify-gate";
import { fitVerifyService } from "@/services/ai/fit-verify.service";
import { getCityWeather } from "@/services/weather/weather.service";
import { applyWeatherBiasToPlan } from "@/services/weather/apply-weather-bias";
import { isWeatherRelevantWorkflow } from "@/services/weather/weather-relevance";
import { detectWeatherHorizon } from "@/services/weather/horizon";
import type { City } from "@/config/cities";
import type { ChatMessage } from "@/lib/schemas/chat";
import type { BusinessResult } from "@/lib/schemas/business";

const FLAGGED_INPUT_REPLY =
  "I can help with local recommendations — restaurants, activities, places to stay, and more. Tell me what you're looking for.";

/** PostGIS prefilter coords from plan LocationRef — never city centre. */
function searchGeoFromPlan(
  plan: PlannerPlan,
  city: City,
): { lat?: number; lng?: number; radiusMeters?: number } {
  const ref = plan.locationRef;
  if (ref?.lat == null || ref?.lng == null) return {};
  return {
    lat: ref.lat,
    lng: ref.lng,
    radiusMeters:
      plan.constraints.distanceMeters ?? city.defaultRadiusMeters,
  };
}

export interface ConversationParams {
  city: City;
  message: string;
  history?: ChatMessage[];
  userId?: string | null;
  conversationId?: string | null;
  /** Ids to omit from the returned recommendation set. */
  excludeBusinessIds?: string[];
  retry?: boolean;
  /**
   * Evaluation mode: skip answer-cache read/write so baselines are not
   * poisoned by (or poison) production cache entries.
   */
  skipAnswerCache?: boolean;
}

export interface ConversationResult {
  plan: PlannerPlan;
  workflowId: PlannerPlan["workflow"];
  businesses: BusinessResult[];
  composition: ExperienceComposition;
  llmInvoked: boolean;
  clarification: boolean;
  stream: AsyncGenerator<string, void, unknown>;
  telemetry: TurnTelemetry;
  /** Present when QUERY_TRACE=1 — end-to-end forensic audit payload. */
  queryTrace?: QueryTrace;
}

async function* textStream(text: string): AsyncGenerator<string, void, unknown> {
  yield text;
}

function routePathForResolution(type: ResolutionType): RoutePath {
  switch (type) {
    case "KNOWLEDGE_CARD":
      return "knowledge";
    case "LIVE_DATA":
    case "SQL":
      return "sql";
    case "FACT":
      return "capability";
    case "CACHE":
      return "cache";
    default:
      return "knowledge";
  }
}

function mergeBusinessesBySimilarity(
  batches: BusinessResult[][],
): BusinessResult[] {
  const byId = new Map<string, BusinessResult>();
  for (const batch of batches) {
    for (const b of batch) {
      const existing = byId.get(b.id);
      if (!existing || (b.similarity ?? 0) > (existing.similarity ?? 0)) {
        byId.set(b.id, b);
      }
    }
  }
  return [...byId.values()];
}

/**
 * When primary search is empty or off-topic, broaden to related providers for
 * known niche service terms (e.g. ombre → hair salons / colour).
 */
async function tryRelatedServiceFallback(opts: {
  city: City;
  message: string;
  draftQueries: string[];
  plan: PlannerPlan;
}): Promise<ExperienceComposition | null> {
  const expansion = expandRelatedServiceQueries(
    opts.message,
    opts.draftQueries,
  );
  if (!expansion) return null;

  const batches = await Promise.all(
    expansion.queries.map((query) =>
      businessSearchService.search({
        city: opts.city,
        query,
        limit: 25,
        ...searchGeoFromPlan(opts.plan, opts.city),
      }),
    ),
  );
  const merged = mergeBusinessesBySimilarity(batches);
  if (merged.length === 0) return null;

  // Prefer beauty/hair verticals for related beauty asks; avoid home-services
  // filtering that would crush salon scores.
  const ranked = rankBusinesses(merged, opts.plan, {
    quality: 0.1,
    limit: 25,
    verticalHint: "spas",
  });
  if (ranked.length === 0) return null;

  // Flat list — grouped "vibe" buckets are for dining/leisure, not services.
  const relatedPlan: PlannerPlan = {
    ...opts.plan,
    composition: {
      ...opts.plan.composition,
      strategy: "ranked_list",
      titleHint: `Related options for ${expansion.requestedLabel}`,
      maxSections: 1,
      maxItemsPerSection: 12,
      sectionHints: [],
      bucketProfile: undefined,
    },
  };

  const composed = composeExperience(ranked, relatedPlan);
  if (composed.businesses.length === 0) return null;

  return withCompositionGrounding(composed, {
    mode: "related",
    requestedService: expansion.requestedLabel,
    note: expansion.note,
  });
}

/**
 * When no electronics specialist matches a buy ask, offer shopping centres
 * as an honest related place to check counters — never pets/lasertag/etc.
 */
async function tryProductMallFallback(opts: {
  city: City;
  productLabel: string;
  plan: PlannerPlan;
  exclude: (list: BusinessResult[]) => BusinessResult[];
}): Promise<ExperienceComposition | null> {
  const queries = [
    `shopping mall ${opts.city.name}`,
    `lifestyle centre ${opts.city.name}`,
    `Ballito Junction`,
    `electronics ${opts.city.name} mall`,
  ];
  const batches = await Promise.all(
    queries.map((query) =>
      businessSearchService.search({
        city: opts.city,
        query,
        limit: 20,
      }),
    ),
  );
  const merged = opts.exclude(mergeBusinessesBySimilarity(batches));
  const malls = filterShoppingMalls(merged);
  if (malls.length === 0) return null;

  const ranked = rankBusinesses(malls, opts.plan, {
    quality: 0.05,
    limit: 8,
    verticalHint: "shopping",
    minKeep: 0,
    relativeFloor: 0.4,
  });
  if (ranked.length === 0) return null;

  const relatedPlan: PlannerPlan = {
    ...opts.plan,
    composition: {
      ...opts.plan.composition,
      strategy: "ranked_list",
      titleHint: `Shopping centres for ${opts.productLabel}`,
      maxSections: 1,
      maxItemsPerSection: 8,
      sectionHints: [],
      bucketProfile: undefined,
    },
  };

  const composed = composeExperience(ranked, relatedPlan);
  const fitted = enforceProductAskFit(composed.businesses, "related");
  if (fitted.length === 0) return null;

  const fittedComposition: ExperienceComposition = {
    ...composed,
    businesses: fitted,
    sections: composed.sections
      .map((section) => ({
        ...section,
        businessIds: section.businessIds.filter((id) =>
          fitted.some((b) => b.id === id),
        ),
      }))
      .filter((section) => section.businessIds.length > 0),
  };

  return withCompositionGrounding(fittedComposition, {
    mode: "related",
    requestedService: opts.productLabel,
    note: `No dedicated specialist for "${opts.productLabel}" matched — these shopping centres are places to check electronics counters.`,
  });
}

async function logOrchestration(opts: {
  userId?: string | null;
  conversationId?: string | null;
  plan: PlannerPlan;
  businesses: BusinessResult[];
  composition: ExperienceComposition;
  llmInvoked: boolean;
  latencyMs: number;
  message: string;
  citySlug: string;
  telemetry: TurnTelemetry;
}) {
  const telemetry: TurnTelemetry = {
    ...opts.telemetry,
    latencyMs: opts.latencyMs,
    candidateCount: opts.businesses.length,
    llmUsed:
      opts.telemetry.llmStages.extract ||
      opts.telemetry.llmStages.narrate ||
      opts.telemetry.llmStages.fitVerify,
    primaryRoute: primaryRouteFromPaths(opts.telemetry.routePaths),
  };

  captureTurnRouting({
    userId: opts.userId,
    citySlug: opts.citySlug,
    telemetry,
  });

  captureServerEvent({
    distinctId: opts.userId ?? "anonymous",
    event: "composition_strategy",
    properties: {
      strategy: opts.composition.strategy,
      workflow: opts.plan.workflow,
      business_count: opts.businesses.length,
      llm_invoked: opts.llmInvoked,
      query_class: telemetry.queryClass,
      primary_route: telemetry.primaryRoute,
      cache_hit: telemetry.cacheHit,
    },
  });

  if (opts.conversationId) {
    try {
      const sticky = {
        workflow: opts.plan.workflow,
        goalType: opts.plan.goal.primary,
        updatedAt: new Date().toISOString(),
        constraints: {
          openNow: opts.plan.constraints.openNow ?? null,
          budget: opts.plan.constraints.budget ?? null,
          partySize: opts.plan.constraints.partySize ?? null,
          distanceLabel: opts.plan.constraints.distanceLabel ?? null,
        },
        cuisines: opts.plan.entities?.cuisines ?? [],
        locationLabel: opts.plan.locationRef?.label ?? null,
      };
      const admin = createAdminClient();
      await admin
        .from("conversations")
        .update({
          sticky_summary: sticky as unknown as import("@/types/database").Json,
        })
        .eq("id", opts.conversationId);
    } catch {
      // sticky is best-effort
    }
  }

  await logAiCall({
    service: "ConversationOrchestrator",
    promptVersion: null,
    model: null,
    input: { message: opts.message, city: opts.citySlug },
    output: {
      plan: opts.plan,
      workflowId: opts.plan.workflow,
      goal: opts.plan.goal,
      clarification: opts.plan.needsClarification,
      responseMode: opts.plan.responseMode,
      compositionStrategy: opts.composition.strategy,
      grounding: opts.composition.grounding ?? null,
      compositionSections: opts.composition.sections.map((s) => ({
        id: s.id,
        title: s.title,
        count: s.businessIds.length,
      })),
      executionPlan: opts.plan.executionPlan.map((s) => ({
        id: s.id,
        capability: s.capability,
        query: s.query,
      })),
      retrievedIds: opts.businesses.map((b) => b.id),
      ranking: opts.businesses.map((b) => ({
        id: b.id,
        name: b.name,
        score: b.score ?? 0,
      })),
      llmInvoked: opts.llmInvoked,
      locationRef: opts.plan.locationRef,
      diagnostics: opts.plan.diagnostics,
      routing: telemetryToLogFields(telemetry),
    },
    latencyMs: opts.latencyMs,
    status: "success",
    userId: opts.userId,
    conversationId: opts.conversationId,
  });
}

async function* streamWithGrounding(
  stream: AsyncGenerator<string, void, unknown>,
  businesses: BusinessResult[],
  userId?: string | null,
  conversationId?: string | null,
): AsyncGenerator<string, void, unknown> {
  let full = "";
  for await (const delta of stream) {
    full += delta;
    yield delta;
  }
  checkNarrationGrounding({
    narration: full,
    businessPhones: businesses.map((b) => b.phone),
    userId,
    conversationId,
  });
}

/**
 * Planner v2 orchestrator:
 * classify → cache → knowledge resolver → (extract|short-circuit) → resolve → capabilities → rank → compose → explain
 */
export class ConversationService {
  async handle(params: ConversationParams): Promise<ConversationResult> {
    const {
      city,
      message,
      history = [],
      userId,
      conversationId,
      excludeBusinessIds = [],
      retry = false,
      skipAnswerCache = false,
    } = params;
    const bypassAnswerCache = retry || skipAnswerCache;
    const start = Date.now();
    const telemetry = createTurnTelemetry();
    const clean = sanitizeUserInput(message);
    const excludeSet = new Set(
      excludeBusinessIds.map((id) => id.trim()).filter(Boolean),
    );

    const withoutExcluded = (list: BusinessResult[]) =>
      excludeSet.size === 0
        ? list
        : list.filter((b) => !excludeSet.has(b.id));

    const finishLog = async (opts: {
      plan: PlannerPlan;
      businesses: BusinessResult[];
      composition: ExperienceComposition;
      llmInvoked: boolean;
    }) => {
      await logOrchestration({
        userId,
        conversationId,
        plan: opts.plan,
        businesses: opts.businesses,
        composition: opts.composition,
        llmInvoked: opts.llmInvoked,
        latencyMs: Date.now() - start,
        message: clean.sanitized,
        citySlug: city.slug,
        telemetry,
      });
    };

    // Prompt-injection patterns: refuse the model call, return a safe reply.
    if (clean.flagged) {
      captureAbuseEvent({
        event: "injection_flagged",
        distinctId: userId,
        properties: { reasons: clean.reasons, area: "message" },
      });
      const context = buildConversationContext({ city, history: [] });
      const plan = resolvePlannerPlan(FALLBACK_DRAFT, context, clean.sanitized);
      const empty = emptyComposition(plan.composition.strategy);
      telemetry.routePaths.push("capability");
      telemetry.queryClass = "CONVERSATION";
      await logAiCall({
        service: "ConversationOrchestrator",
        promptVersion: null,
        model: null,
        input: {
          message: clean.sanitized,
          flagged: true,
          reasons: clean.reasons,
        },
        output: { blocked: true, routing: telemetryToLogFields(telemetry) },
        latencyMs: Date.now() - start,
        status: "success",
        userId,
        conversationId,
      });
      return {
        plan,
        workflowId: plan.workflow,
        businesses: [],
        composition: empty,
        llmInvoked: false,
        clarification: false,
        stream: textStream(FLAGGED_INPUT_REPLY),
        telemetry,
      };
    }

    const contextHistory = sanitizeHistoryForContext(history);
    const modelHistory = prepareHistoryForModel(history);

    let stickySummary = null;
    if (conversationId) {
      try {
        const admin = createAdminClient();
        const { data } = await admin
          .from("conversations")
          .select("sticky_summary")
          .eq("id", conversationId)
          .maybeSingle();
        stickySummary = parseStickySummary(data?.sticky_summary ?? null);
      } catch {
        // best-effort
      }
    }

    const stickyHash = hashStickyPayload(stickySummary);
    const context = buildConversationContext({
      city,
      history: contextHistory,
      stickySummary,
    });

    // --- Query classification (before any LLM / retrieval) ---
    const classification = classifyQuery({
      message: clean.sanitized,
      citySlug: city.slug,
    });
    telemetry.queryClass = classification.queryClass;
    telemetry.classifierConfidence = classification.confidence;
    telemetry.classifierSignals = classification.signals;

    if (intelligenceFlags.classifierShadow()) {
      captureServerEvent({
        distinctId: userId ?? "anonymous",
        event: "classifier_shadow",
        properties: {
          query_class: classification.queryClass,
          confidence: classification.confidence,
          signals: classification.signals,
          can_skip_extractor: classification.canSkipExtractor,
          city: city.slug,
        },
      });
    }

    // --- Answer cache ---
    if (intelligenceFlags.answerCache() && !bypassAnswerCache) {
      const cacheKey = answerCacheKey({
        citySlug: city.slug,
        message: clean.sanitized,
        stickyHash,
        rankConfigVersion: getRankConfigVersion(),
      });
      const cached = await getCachedAnswer(cacheKey);
      if (cached) {
        telemetry.cacheHit = true;
        telemetry.routePaths.push("cache");
        telemetry.narrationSkipped = true;
        const plan = resolvePlannerPlan(
          FALLBACK_DRAFT,
          context,
          clean.sanitized,
        );
        // Prefer cached plan snapshot fields where possible
        const cachedPlan: PlannerPlan = {
          ...plan,
          workflow: cached.planSnapshot.workflow,
          responseMode: cached.planSnapshot.responseMode,
          llmRequired: false,
          intent: cached.planSnapshot.intent,
          goal: cached.planSnapshot.goal,
        };
        await finishLog({
          plan: cachedPlan,
          businesses: cached.businesses,
          composition: cached.composition,
          llmInvoked: false,
        });
        return {
          plan: cachedPlan,
          workflowId: cachedPlan.workflow,
          businesses: cached.businesses,
          composition: cached.composition,
          llmInvoked: false,
          clarification: false,
          stream: textStream(cached.text),
          telemetry,
        };
      }
    }

    // --- Knowledge Resolver (flagged) or legacy knowledge-card fast path ---
    let knowledgeCardSeedQueries: string[] = [];

    if (intelligenceFlags.knowledgeResolver()) {
      const resolverStarted = Date.now();
      const resolution = await resolveKnowledge({
        message: clean.sanitized,
        city,
        classification,
        context,
        excludeBusinessIds: excludeSet,
        retry,
      });
      telemetry.stageLatencyMs.knowledge_resolver = Date.now() - resolverStarted;
      telemetry.knowledgeResolutionType = resolution.type;
      telemetry.knowledgeResolverPlugin =
        resolution.pluginId === "none" ? null : resolution.pluginId;
      telemetry.knowledgeResolved = resolution.answered;

      if (resolution.signals?.length) {
        classification.signals.push(...resolution.signals);
      }
      if (
        resolution.draftQueries?.length &&
        classification.draftQueries.length === 0
      ) {
        classification.draftQueries.push(...resolution.draftQueries);
      } else if (resolution.draftQueries?.length) {
        for (const q of resolution.draftQueries) {
          if (!classification.draftQueries.includes(q)) {
            classification.draftQueries.push(q);
          }
        }
      }
      telemetry.classifierSignals = classification.signals;

      if (resolution.answered && resolution.text) {
        const plan =
          resolution.plan ??
          (() => {
            const base = resolveFromClassification(
              classification,
              context,
              clean.sanitized,
            );
            return {
              ...base,
              llmRequired: false,
              responseMode: "fast_path" as const,
              diagnostics: {
                ...base.diagnostics,
                rulesApplied: [
                  ...base.diagnostics.rulesApplied,
                  `knowledge_resolver:${resolution.pluginId}`,
                ],
              },
            };
          })();

        const businesses = resolution.businesses ?? [];
        const composition =
          resolution.composition ??
          emptyComposition(plan.composition.strategy);

        telemetry.routePaths.push(routePathForResolution(resolution.type));
        telemetry.retrievalMode =
          resolution.type === "KNOWLEDGE_CARD" ? "knowledge" : "none";
        telemetry.narrationSkipped = true;
        telemetry.extractorSkipped = true;
        telemetry.candidateCount = businesses.length;

        if (intelligenceFlags.answerCache() && !bypassAnswerCache) {
          const cacheKey = answerCacheKey({
            citySlug: city.slug,
            message: clean.sanitized,
            stickyHash,
            rankConfigVersion: getRankConfigVersion(),
          });
          await setCachedAnswer(cacheKey, {
            text: resolution.text,
            businesses,
            composition,
            planSnapshot: {
              workflow: plan.workflow,
              responseMode: plan.responseMode,
              llmRequired: false,
              intent: plan.intent,
              goal: plan.goal,
            },
            queryClass: telemetry.queryClass,
            cachedAt: new Date().toISOString(),
          });
        }

        await finishLog({
          plan,
          businesses,
          composition,
          llmInvoked: false,
        });

        return {
          plan,
          workflowId: plan.workflow,
          businesses,
          composition,
          llmInvoked: false,
          clarification: false,
          stream: textStream(resolution.text),
          telemetry,
        };
      }

      if (resolution.pluginId === "knowledge-card") {
        telemetry.routePaths.push("knowledge");
      }
    } else if (intelligenceFlags.knowledgeCards()) {
      // Legacy inline knowledge-card path (KNOWLEDGE_RESOLVER off).
      const storedCard = await findKnowledgeCard({
        citySlug: city.slug,
        message: clean.sanitized,
      });
      if (storedCard) {
        classification.signals.push(`knowledge_card:${storedCard.slug}`);

        const cardIds = storedCard.businessIds.filter((id) => !excludeSet.has(id));
        if (cardIds.length > 0 && !retry) {
          const loaded = await businessSearchService.getByIds({
            ids: cardIds,
            citySlug: city.slug,
          });
          if (loaded.length > 0) {
            if (storedCard.searchQueries.length > 0) {
              classification.draftQueries = [
                ...storedCard.searchQueries,
                ...classification.draftQueries,
              ];
            }
            let cardPlan = resolveFromClassification(
              classification,
              context,
              clean.sanitized,
            );
            cardPlan = {
              ...cardPlan,
              llmRequired: false,
              responseMode: "execute_and_explain",
              composition: {
                ...cardPlan.composition,
                strategy: "ranked_list",
                titleHint: storedCard.title,
              },
              diagnostics: {
                ...cardPlan.diagnostics,
                rulesApplied: [
                  ...cardPlan.diagnostics.rulesApplied,
                  "knowledge_card_fast_path",
                ],
              },
            };

            const ranked = rankBusinesses(
              loaded,
              cardPlan,
              loadRankConfig({
                limit: Math.min(8, loaded.length),
                minKeep: Math.min(3, loaded.length),
                preferVariety: false,
              }),
            );
            const composition = composeExperience(ranked, cardPlan);
            const seed = matchKnowledgeCardSeed(clean.sanitized);
            const text =
              formatCompositionConversational(composition, {
                introHint:
                  seed?.bodyTemplate ||
                  storedCard.render.headline ||
                  storedCard.bodyMd ||
                  storedCard.title,
                cityName: city.name,
                servicesTone:
                  cardPlan.workflow === "services" ||
                  cardPlan.workflow === "healthcare",
              }) || ranked.map((b) => b.name).join(", ");

            telemetry.routePaths.push("knowledge");
            telemetry.retrievalMode = "knowledge";
            telemetry.narrationSkipped = true;
            telemetry.extractorSkipped = true;
            telemetry.candidateCount = ranked.length;
            telemetry.classifierSignals = classification.signals;

            if (intelligenceFlags.answerCache() && !bypassAnswerCache) {
              const cacheKey = answerCacheKey({
                citySlug: city.slug,
                message: clean.sanitized,
                stickyHash,
                rankConfigVersion: getRankConfigVersion(),
              });
              await setCachedAnswer(cacheKey, {
                text,
                businesses: composition.businesses,
                composition,
                planSnapshot: {
                  workflow: cardPlan.workflow,
                  responseMode: cardPlan.responseMode,
                  llmRequired: false,
                  intent: cardPlan.intent,
                  goal: cardPlan.goal,
                },
                queryClass: telemetry.queryClass,
                cachedAt: new Date().toISOString(),
              });
            }

            await finishLog({
              plan: cardPlan,
              businesses: composition.businesses,
              composition,
              llmInvoked: false,
            });

            return {
              plan: cardPlan,
              workflowId: cardPlan.workflow,
              businesses: composition.businesses,
              composition,
              llmInvoked: false,
              clarification: false,
              stream: textStream(text),
              telemetry,
            };
          }
        }

        // No stored members yet — seed search queries from the card/seed.
        knowledgeCardSeedQueries =
          storedCard.searchQueries.length > 0
            ? storedCard.searchQueries
            : (matchKnowledgeCardSeed(clean.sanitized)?.searchQueries ?? []);
        if (
          knowledgeCardSeedQueries.length > 0 &&
          classification.draftQueries.length === 0
        ) {
          classification.draftQueries.push(...knowledgeCardSeedQueries);
        }
        telemetry.routePaths.push("knowledge");
        telemetry.classifierSignals = classification.signals;
      }
    }

    // --- Understand (QI / extract) or short-circuit ---
    let resolved: PlannerPlan;
    let understandingDraft: PlannerDraft | null = null;
    let understandingSource: QueryTrace["understanding"]["source"] =
      "planner_extractor";
    const queryTrace = intelligenceFlags.queryTrace()
      ? emptyQueryTrace(clean.sanitized, city.slug)
      : null;
    if (queryTrace) {
      queryTrace.classification = {
        queryClass: classification.queryClass,
        confidence: classification.confidence,
        signals: classification.signals,
        canSkipExtractor: classification.canSkipExtractor,
        didShortCircuit: false,
      };
    }

    const shouldShortCircuit = shouldShortCircuitExtractor(classification);

    // QI shadow: log QI draft while still serving legacy short-circuit/extractor.
    if (
      intelligenceFlags.qiShadow() &&
      !intelligenceFlags.queryIntelligence() &&
      !shouldShortCircuit
    ) {
      try {
        const shadow = await queryIntelligenceService.understand({
          context,
          message: clean.sanitized,
          userId,
          conversationId,
        });
        captureServerEvent({
          distinctId: userId ?? "anonymous",
          event: "qi_shadow",
          properties: {
            city: city.slug,
            goal: shadow.draft.goal.primary,
            concepts: shadow.draft.searchConcepts?.length ?? 0,
            facets: shadow.draft.planFacets.length,
            confidence: shadow.draft.confidence,
          },
        });
      } catch {
        // shadow must never break chat
      }
    }

    if (shouldShortCircuit) {
      telemetry.extractorSkipped = true;
      understandingSource = "classifier_short_circuit";
      if (queryTrace) queryTrace.classification.didShortCircuit = true;
      understandingDraft = draftFromClassification(
        classification,
        clean.sanitized,
      );
      resolved = resolveFromClassification(
        classification,
        context,
        clean.sanitized,
      );
    } else if (intelligenceFlags.queryIntelligence()) {
      telemetry.llmStages.extract = true;
      telemetry.routePaths.push("llm_extract");
      understandingSource = "query_intelligence";
      const { draft } = await queryIntelligenceService.understand({
        context,
        message: clean.sanitized,
        userId,
        conversationId,
      });
      understandingDraft = draft;
      resolved = resolvePlannerPlan(draft, context, clean.sanitized);
    } else {
      telemetry.llmStages.extract = true;
      telemetry.routePaths.push("llm_extract");
      understandingSource = "planner_extractor";
      const draft = await plannerExtractorService.extract({
        context,
        message: clean.sanitized,
        userId,
        conversationId,
      });
      understandingDraft = draft;
      resolved = resolvePlannerPlan(draft, context, clean.sanitized);
    }

    if (queryTrace && understandingDraft) {
      const audienceFromNotes =
        understandingDraft.notes?.match(/audience=([a-z_]+)/)?.[1] ?? null;
      queryTrace.understanding = {
        source: understandingSource,
        goalPrimary: understandingDraft.goal.primary,
        goalDescription: understandingDraft.goal.description,
        draftQueries: [...understandingDraft.draftQueries],
        planFacetCount: understandingDraft.planFacets.length,
        searchConcepts: [
          ...(understandingDraft.searchConcepts ??
            understandingDraft.draftQueries),
        ],
        hardExclusions: [...(understandingDraft.hardExclusions ?? [])],
        softPreferences: [],
        audience:
          resolved.constraints.audienceRequired ?? audienceFromNotes,
        requiredConstraints: summarizeRequiredConstraints(
          resolved.constraints,
        ),
        preferredConstraints: compactNonNullFlags(
          resolved.constraints.preferred,
        ),
        environmentRequired: resolved.constraints.environmentRequired,
        facets: understandingDraft.planFacets.map((f) => ({
          id: f.id,
          label: f.label,
          hard: f.hard === true,
          verticalHint: f.verticalHint,
        })),
        confidence: understandingDraft.confidence,
        notes: understandingDraft.notes,
      };
      queryTrace.plan = {
        workflow: resolved.workflow,
        executionQueries: resolved.executionPlan.map((s) => s.query),
        llmRequired: resolved.llmRequired,
        needsClarification: resolved.needsClarification,
        rulesApplied: [...resolved.diagnostics.rulesApplied],
        bucketProfile: resolved.composition.bucketProfile ?? null,
        compositionStrategy: resolved.composition.strategy,
      };
    }

    // Apply deterministic narration skip from feature flag + classification
    if (
      intelligenceFlags.deterministicNarrationSkip() &&
      classification.preferDeterministicNarration &&
      classification.confidence >= CLASSIFIER_SHORT_CIRCUIT_THRESHOLD &&
      resolved.responseMode === "execute_and_explain" &&
      resolved.workflow !== "special_occasion" &&
      resolved.workflow !== "relocation"
    ) {
      resolved = {
        ...resolved,
        llmRequired: false,
        diagnostics: {
          ...resolved.diagnostics,
          rulesApplied: [
            ...resolved.diagnostics.rulesApplied,
            "flag_deterministic_narration_skip",
          ],
        },
      };
      telemetry.narrationSkipped = true;
    }

    const weatherRelevant = isWeatherRelevantWorkflow(resolved.workflow);
    const weatherHorizon = detectWeatherHorizon(clean.sanitized);
    const weather = weatherRelevant
      ? await getCityWeather(city, { horizon: weatherHorizon })
      : null;
    const plan = applyWeatherBiasToPlan(resolved, weather);
    const def = getWorkflowDefinition(plan.workflow);
    const explain = explanationForWorkflow(plan.workflow);
    const empty = emptyComposition(plan.composition.strategy);

    if (plan.responseMode === "clarify") {
      const text =
        plan.clarificationQuestion ??
        "What are you looking for in Ballito?";
      telemetry.routePaths.push("capability");
      await finishLog({
        plan,
        businesses: [],
        composition: empty,
        llmInvoked: false,
      });
      return {
        plan,
        workflowId: plan.workflow,
        businesses: [],
        composition: empty,
        llmInvoked: false,
        clarification: true,
        stream: textStream(text),
        telemetry,
      };
    }

    const execution = await runExecutionPlan({
      plan,
      city,
      message: clean.sanitized,
    });
    telemetry.retrievalMode = intelligenceFlags.hybridSearch()
      ? "hybrid"
      : "vector";
    if (execution.businesses.length > 0) {
      telemetry.routePaths.push(
        intelligenceFlags.hybridSearch() ? "hybrid" : "sql",
      );
    }
    if (execution.fastPathText) {
      telemetry.routePaths.push("capability");
    }

    if (
      plan.responseMode === "fast_path" ||
      (execution.fastPathText &&
        (plan.workflow === "emergency" ||
          (plan.workflow === "general" && execution.businesses.length === 0)))
    ) {
      const text =
        execution.fastPathText ??
        def.responseBehaviour.emptyResultsMessage;
      await finishLog({
        plan,
        businesses: [],
        composition: empty,
        llmInvoked: false,
      });
      return {
        plan,
        workflowId: plan.workflow,
        businesses: [],
        composition: empty,
        llmInvoked: false,
        clarification: false,
        stream: textStream(text),
        telemetry,
      };
    }

    const rankConfig = {
      ...loadRankConfig(def.rankConfig),
      // Multi-vertical event plans must not rank against a single jewellery hint.
      verticalHint:
        plan.workflow === "special_occasion"
          ? null
          : verticalHintFromPlan(plan),
    };

    let candidates = withoutExcluded(execution.businesses);

    const tradeKind = detectTradeKind(clean.sanitized);
    const urgentTrade = isUrgentTradeAsk(clean.sanitized);
    const productAsk = isProductPurchaseAsk(clean.sanitized);
    const productLabel = productAsk
      ? extractProductLabel(clean.sanitized)
      : null;
    const musicAsk = !productAsk && isMusicInstrumentAsk(clean.sanitized);
    const musicLabel = musicAsk
      ? extractMusicLabel(clean.sanitized)
      : null;
    const autoProtectionAsk =
      !productAsk && !musicAsk && isAutoProtectionAsk(clean.sanitized);
    const autoProtectionLabel = autoProtectionAsk
      ? extractAutoProtectionLabel(clean.sanitized)
      : null;
    const autoPartsAsk =
      !productAsk &&
      !musicAsk &&
      !autoProtectionAsk &&
      isAutoPartsAsk(clean.sanitized);
    const autoPartsLabel = autoPartsAsk
      ? extractAutoPartsLabel(clean.sanitized)
      : null;
    const exactNiche =
      !productAsk &&
      !musicAsk &&
      !autoProtectionAsk &&
      !autoPartsAsk &&
      plan.workflow !== "special_occasion" &&
      (tradeKind != null || isExactNicheAsk(clean.sanitized));
    const nicheLabel = exactNiche
      ? extractExactNicheLabel(clean.sanitized)
      : null;
    const specialOccasion =
      plan.workflow === "special_occasion" ||
      plan.composition.bucketProfile === "plan_facets" ||
      plan.composition.bucketProfile === "special_occasion";
    const planFacets = plan.composition.planFacets ?? [];
    const medicalCareAsk =
      plan.workflow === "healthcare" || isHumanMedicalAsk(clean.sanitized);

    // Leisure discovery: deepen the pool. Exact niches: stay strict.
    // Celebrations deepen dining facets only (keep jewellery/cake searches tight).
    // Meal-time asks stay strict — variety round-robin pulls malls/QSR back in.
    const mealTimeAsk =
      detectMealTime(clean.sanitized) != null ||
      plan.constraints.preferred.breakfast === true ||
      plan.constraints.preferred.lunch === true ||
      plan.constraints.preferred.dinner === true;
    const wantsVariety =
      !urgentTrade &&
      !productAsk &&
      !musicAsk &&
      !autoProtectionAsk &&
      !autoPartsAsk &&
      !exactNiche &&
      !specialOccasion &&
      !medicalCareAsk &&
      !mealTimeAsk &&
      (plan.composition.strategy === "grouped_sections" ||
        plan.composition.strategy === "ranked_list" ||
        plan.composition.strategy === "itinerary" ||
        plan.composition.strategy === "comparison" ||
        excludeSet.size > 0);

    const searchGeo = searchGeoFromPlan(plan, city);

    // When QI already emitted multi-concept draftQueries, skip regex deepen loops
    // that re-interpret the ask (filters still apply below).
    const skipNicheDeepen =
      Boolean(understandingDraft?.notes?.startsWith("qi:")) &&
      intelligenceFlags.qiTrustUnderstanding() &&
      (understandingDraft?.draftQueries.length ?? 0) >= 2;

    if (productAsk && productLabel && !skipNicheDeepen) {
      const queries = productSearchQueries(productLabel, city.name);
      const extras = await Promise.all(
        queries.map((query) =>
          businessSearchService.search({
            city,
            query,
            limit: 25,
            ...searchGeo,
          }),
        ),
      );
      candidates = mergeBusinessesBySimilarity([
        candidates,
        ...extras.map(withoutExcluded),
      ]);
      candidates = filterProductSpecialists(candidates);
    } else if (musicAsk && musicLabel && !skipNicheDeepen) {
      const queries = musicSearchQueries(musicLabel, city.name);
      const extras = await Promise.all(
        queries.map((query) =>
          businessSearchService.search({
            city,
            query,
            limit: 25,
            ...searchGeo,
          }),
        ),
      );
      candidates = mergeBusinessesBySimilarity([
        candidates,
        ...extras.map(withoutExcluded),
      ]);
      candidates = filterMusicSpecialists(candidates);
    } else if (autoProtectionAsk && autoProtectionLabel && !skipNicheDeepen) {
      const queries = autoProtectionSearchQueries(
        autoProtectionLabel,
        city.name,
      );
      const extras = await Promise.all(
        queries.map((query) =>
          businessSearchService.search({
            city,
            query,
            limit: 25,
            ...searchGeo,
          }),
        ),
      );
      candidates = mergeBusinessesBySimilarity([
        candidates,
        ...extras.map(withoutExcluded),
      ]);
      candidates = filterAutoProtectionSpecialists(candidates);
    } else if (autoPartsAsk && autoPartsLabel && !skipNicheDeepen) {
      const queries = autoPartsSearchQueries(autoPartsLabel, city.name);
      const extras = await Promise.all(
        queries.map((query) =>
          businessSearchService.search({
            city,
            query,
            limit: 25,
            ...searchGeo,
          }),
        ),
      );
      candidates = mergeBusinessesBySimilarity([
        candidates,
        ...extras.map(withoutExcluded),
      ]);
      candidates = filterAutoPartsSpecialists(candidates);
    }

    // Enforcement filters still apply when QI skipped deepen retrieval.
    if (skipNicheDeepen) {
      if (productAsk) candidates = filterProductSpecialists(candidates);
      if (musicAsk) candidates = filterMusicSpecialists(candidates);
      if (autoProtectionAsk) {
        candidates = filterAutoProtectionSpecialists(candidates);
      }
      if (autoPartsAsk) candidates = filterAutoPartsSpecialists(candidates);
    }

    if (specialOccasion && planFacets.length > 0) {
      // Deepen every checklist facet so sections can hit the min-of-3 rule.
      const extras = await Promise.all(
        planFacets.map(async (facet) => {
          const raw = await businessSearchService.search({
            city,
            query: facet.searchQuery,
            limit: isDiningPlanFacet(facet) ? 40 : 25,
            ...searchGeo,
          });
          const scoped = facet.verticalHint
            ? filterByVerticalHint(raw, facet.verticalHint)
            : isDiningPlanFacet(facet)
              ? filterByVerticalHint(raw, "restaurants")
              : raw;
          return scoped.map((b) => withPlanFacet(b, facet.id, facet.label));
        }),
      );
      candidates = mergeBusinessesBySimilarity([
        candidates,
        ...extras.map(withoutExcluded),
      ]);
    } else if (wantsVariety && candidates.length < 12) {
      // Only deepen when the primary plan returned a thin pool — avoid a
      // redundant embed+RPC when we already have enough on-vertical hits.
      const extra = await businessSearchService.search({
        city,
        query: clean.sanitized,
        limit: 40,
        ...searchGeo,
      });
      candidates = mergeBusinessesBySimilarity([
        candidates,
        withoutExcluded(extra),
      ]);
    } else if (urgentTrade && tradeKind) {
      // Keep “24 hour” / emergency wording in retrieval — draft queries often drop it.
      const queries = tradeSearchQueries(
        tradeKind,
        clean.sanitized,
        city.name,
      );
      const extras = await Promise.all(
        queries.map((query) =>
          businessSearchService.search({
            city,
            query,
            limit: 25,
            ...searchGeo,
          }),
        ),
      );
      candidates = mergeBusinessesBySimilarity([
        candidates,
        ...extras.map(withoutExcluded),
      ]);
    } else if (urgentTrade) {
      const extra = await businessSearchService.search({
        city,
        query: clean.sanitized,
        limit: 30,
        ...searchGeo,
      });
      candidates = mergeBusinessesBySimilarity([
        candidates,
        withoutExcluded(extra),
      ]);
    } else if (medicalCareAsk) {
      // Don't embed typo asks ("docotor open noq") — search clean medical needles.
      const medicalQueries =
        rankConfig.verticalHint === "hospitals"
          ? [
              "hospital emergency Ballito",
              "urgent care Ballito",
              "medical clinic Ballito",
              "doctors Ballito",
            ]
          : [
              "doctor GP Ballito",
              "medical clinic Ballito",
              "family practice Ballito",
              "doctors Ballito",
            ];
      const extras = await Promise.all(
        medicalQueries.map((query) =>
          businessSearchService.search({
            city,
            query,
            limit: 25,
            ...searchGeo,
          }),
        ),
      );
      candidates = mergeBusinessesBySimilarity([
        candidates,
        ...extras.map(withoutExcluded),
      ]);
      candidates = filterByVerticalHint(
        candidates,
        rankConfig.verticalHint ?? "doctors",
      );
    }

    if (tradeKind) {
      // Exact trade: empty is better than padding with a neighbouring industry.
      candidates = filterToTradeKind(candidates, tradeKind, { strict: true });
    }

    if (
      rankConfig.verticalHint === "restaurants" ||
      plan.workflow === "restaurants"
    ) {
      candidates = filterByVerticalHint(candidates, "restaurants");
    }

    if (medicalCareAsk) {
      candidates = filterByVerticalHint(
        candidates,
        rankConfig.verticalHint ?? "doctors",
      );
    }

    if (specialOccasion) {
      const adultDowntime = isAdultDowntimeAsk(clean.sanitized);
      candidates = filterCelebrationAudienceNoise(candidates, {
        familyFriendly: plan.constraints.preferred.familyFriendly,
        romantic: plan.constraints.preferred.romantic,
        kidsAsk: plan.constraints.preferred.kidsArea === true,
        adultDowntime,
        facets: planFacets,
      });
    }

    const verticalHint = rankConfig.verticalHint;
    const exactIntent =
      tradeKind != null ||
      productAsk ||
      musicAsk ||
      autoProtectionAsk ||
      autoPartsAsk ||
      exactNiche ||
      (isExactVerticalHint(verticalHint) && !medicalCareAsk);

    const tradeLimit =
      urgentTrade && plan.constraints.openNow === true
        ? 10
        : urgentTrade
          ? 8
          : rankConfig.limit;

    let ranked: BusinessResult[] = [];
    if (candidates.length > 0) {
      const hardExclusions = understandingDraft?.hardExclusions ?? [];
      let candidatesForRank =
        hardExclusions.length > 0
          ? filterByHardExclusions(candidates, hardExclusions)
          : candidates;
      if (
        hardExclusions.length > 0 &&
        candidatesForRank.length < candidates.length
      ) {
        plan.diagnostics.rulesApplied = [
          ...plan.diagnostics.rulesApplied,
          "qi_hard_exclusions_applied",
        ];
      }

      // Universal hard eligibility: required dims gate before ranking.
      const eligibility = filterByHardEligibility(
        candidatesForRank,
        plan.constraints,
      );
      if (queryTrace) {
        const dropReasons: Record<string, number> = {};
        for (const d of eligibility.dropped) {
          for (const r of d.reasons) {
            dropReasons[r] = (dropReasons[r] ?? 0) + 1;
          }
        }
        queryTrace.eligibility = {
          hadHardRequirements: eligibility.hadHardRequirements,
          inputCount: candidatesForRank.length,
          eligibleCount: eligibility.eligible.length,
          droppedCount: eligibility.dropped.length,
          dropReasons,
          droppedSample: eligibility.dropped.slice(0, 12).map((d) => ({
            name: d.name,
            reasons: [...d.reasons],
          })),
        };
      }
      if (
        eligibility.hadHardRequirements &&
        eligibility.dropped.length > 0
      ) {
        plan.diagnostics.rulesApplied = [
          ...plan.diagnostics.rulesApplied,
          "hard_eligibility_applied",
        ];
      }
      candidatesForRank = eligibility.eligible;

      // Precision over fill: when hard gates are active, do not pad with weak scores.
      const hardConstrainedAsk = hasHardEligibilityRequirements(
        plan.constraints,
      );

      ranked = rankBusinesses(candidatesForRank, plan, {
        ...rankConfig,
        preferVariety:
          wantsVariety &&
          !exactIntent &&
          !specialOccasion &&
          !hardConstrainedAsk,
        weatherBias: plan.composition.weatherBias ?? null,
        limit: urgentTrade
          ? Math.min(rankConfig.limit ?? 25, tradeLimit ?? 10)
          : productAsk ||
              musicAsk ||
              autoProtectionAsk ||
              autoPartsAsk ||
              exactNiche
            ? Math.min(rankConfig.limit ?? 25, 10)
            : specialOccasion
              ? Math.max(rankConfig.limit ?? 24, 40)
              : rankConfig.limit,
        // Never force weak/off-trade fillers for exact service / product asks.
        // minKeep: 0 disables the default floor fill (ranking defaults to 6).
        minKeep: exactIntent || hardConstrainedAsk
          ? 0
          : medicalCareAsk
            ? 4
            : specialOccasion
              ? 12
              : urgentTrade
                ? 3
                : undefined,
        relativeFloor: exactIntent || hardConstrainedAsk
          ? 0.55
          : medicalCareAsk
            ? 0.28
            : specialOccasion
              ? 0.35
              : urgentTrade
                ? 0.3
                : undefined,
        ...(productAsk ? { verticalHint: "electronics" } : {}),
        ...(musicAsk ? { verticalHint: "music-instruments" } : {}),
        ...(autoProtectionAsk ? { verticalHint: "automotive" } : {}),
        ...(autoPartsAsk ? { verticalHint: "auto-parts" } : {}),
      });
    }

    if (productAsk) {
      ranked = enforceProductAskFit(ranked, "exact");
    }
    if (musicAsk) {
      ranked = filterMusicSpecialists(ranked);
    }
    if (autoProtectionAsk) {
      ranked = filterAutoProtectionSpecialists(ranked);
    }
    if (autoPartsAsk) {
      ranked = filterAutoPartsSpecialists(ranked);
    }
    if (specialOccasion) {
      const adultDowntime = isAdultDowntimeAsk(clean.sanitized);
      ranked = filterCelebrationAudienceNoise(ranked, {
        familyFriendly: plan.constraints.preferred.familyFriendly,
        romantic: plan.constraints.preferred.romantic,
        kidsAsk: plan.constraints.preferred.kidsArea === true,
        adultDowntime,
        facets: planFacets,
      });
      ranked = filterElevatedCasualDining(ranked, {
        elevated:
          isElevatedCelebrationAsk(clean.sanitized) ||
          adultDowntime ||
          plan.constraints.preferred.quiet === true,
        facets: planFacets,
      });
      ranked = filterPlanFacetVerticalFit(ranked, planFacets);
    }
    // Generic exact niche ask-fit (also tightens trade leftovers).
    // Skip for healthcare — typo asks like "docotor open noq" have needles
    // that never appear on GP listings and wipe the whole result set.
    if (
      exactIntent &&
      !productAsk &&
      !musicAsk &&
      !autoProtectionAsk &&
      !autoPartsAsk &&
      plan.workflow !== "healthcare" &&
      !isHumanMedicalAsk(clean.sanitized)
    ) {
      ranked = filterByAskFit(ranked, clean.sanitized);
    }

    let composition = composeExperience(ranked, plan);

    if (productAsk && productLabel && composition.businesses.length === 0) {
      const mallRelated = await tryProductMallFallback({
        city,
        productLabel,
        plan,
        exclude: withoutExcluded,
      });
      if (mallRelated && mallRelated.businesses.length > 0) {
        composition = mallRelated;
      }
    }

    // Niche attribute asks (e.g. ombre) may related-fallback. Exact niches must not.
    if (!exactIntent && !specialOccasion) {
      const related = await tryRelatedServiceFallback({
        city,
        message: clean.sanitized,
        draftQueries: plan.executionPlan.map((s) => s.query).filter(Boolean),
        plan,
      });
      if (related && related.businesses.length > 0) {
        const relatedBusinesses = withoutExcluded(related.businesses);
        if (relatedBusinesses.length > 0) {
          composition = {
            ...related,
            businesses: relatedBusinesses,
            sections: related.sections
              .map((section) => ({
                ...section,
                businessIds: section.businessIds.filter(
                  (id) => !excludeSet.has(id),
                ),
              }))
              .filter((section) => section.businessIds.length > 0),
          };
        }
      }
    }

    // Final ask-fit for product: strip anything that does not belong.
    if (productAsk) {
      const mode =
        composition.grounding?.mode === "related" ? "related" : "exact";
      const fitted = enforceProductAskFit(composition.businesses, mode);
      if (fitted.length !== composition.businesses.length) {
        composition = {
          ...composition,
          businesses: fitted,
          sections: composition.sections
            .map((section) => ({
              ...section,
              businessIds: section.businessIds.filter((id) =>
                fitted.some((b) => b.id === id),
              ),
            }))
            .filter((section) => section.businessIds.length > 0),
        };
      }
    }

    if (musicAsk) {
      const fitted = filterMusicSpecialists(composition.businesses);
      if (fitted.length !== composition.businesses.length) {
        composition = {
          ...composition,
          businesses: fitted,
          sections: composition.sections
            .map((section) => ({
              ...section,
              businessIds: section.businessIds.filter((id) =>
                fitted.some((b) => b.id === id),
              ),
            }))
            .filter((section) => section.businessIds.length > 0),
        };
      }
    }

    if (autoProtectionAsk) {
      const fitted = filterAutoProtectionSpecialists(composition.businesses);
      if (fitted.length !== composition.businesses.length) {
        composition = {
          ...composition,
          businesses: fitted,
          sections: composition.sections
            .map((section) => ({
              ...section,
              businessIds: section.businessIds.filter((id) =>
                fitted.some((b) => b.id === id),
              ),
            }))
            .filter((section) => section.businessIds.length > 0),
        };
      }
    }

    if (autoPartsAsk) {
      const fitted = filterAutoPartsSpecialists(composition.businesses);
      if (fitted.length !== composition.businesses.length) {
        composition = {
          ...composition,
          businesses: fitted,
          sections: composition.sections
            .map((section) => ({
              ...section,
              businessIds: section.businessIds.filter((id) =>
                fitted.some((b) => b.id === id),
              ),
            }))
            .filter((section) => section.businessIds.length > 0),
        };
      }
    }

    // Final ask-fit for generic exact niches (specialist intents use their own gates).
    // Never ask-fit healthcare — typo tokens wipe real GPs/clinics.
    if (
      exactIntent &&
      !productAsk &&
      !musicAsk &&
      !autoProtectionAsk &&
      !autoPartsAsk &&
      plan.workflow !== "healthcare" &&
      !isHumanMedicalAsk(clean.sanitized) &&
      composition.grounding?.mode !== "related"
    ) {
      composition = applyAskFitToComposition(composition, clean.sanitized);
    }

    // Gated LLM fit verification. Demoted when QUERY_INTELLIGENCE is on
    // (tokens prefer pre-retrieval understanding; re-enable via FIT_VERIFY=1).
    const fitGate = intelligenceFlags.fitVerify()
      ? shouldFitVerify({
          userMessage: clean.sanitized,
          plan,
          composition,
        })
      : { run: false, reason: "fit_verify_flag_off" };
    if (queryTrace) {
      queryTrace.fitVerify = {
        ran: fitGate.run,
        reason: fitGate.reason,
      };
    }
    if (fitGate.run) {
      telemetry.llmStages.fitVerify = true;
      telemetry.routePaths.push("llm_fit_verify");
      composition = await fitVerifyService.verifyCompositionFit({
        userMessage: clean.sanitized,
        plan,
        composition,
        cityName: city.name,
        userId,
        conversationId,
      });
      captureServerEvent({
        distinctId: userId ?? "anonymous",
        event: "fit_verify_ran",
        properties: {
          reason: fitGate.reason,
          workflow: plan.workflow,
          city: city.slug,
          business_count: composition.businesses.length,
        },
      });
    } else {
      captureServerEvent({
        distinctId: userId ?? "anonymous",
        event: "fit_verify_skipped",
        properties: {
          reason: fitGate.reason,
          workflow: plan.workflow,
          city: city.slug,
        },
      });
    }

    if (exactIntent && composition.businesses.length === 0) {
      captureServerEvent({
        distinctId: userId ?? "anonymous",
        event: "exact_intent_empty",
        properties: {
          workflow: plan.workflow,
          trade_kind: tradeKind,
          product_ask: productAsk,
          product_label: productLabel,
          music_ask: musicAsk,
          music_label: musicLabel,
          auto_protection_ask: autoProtectionAsk,
          auto_protection_label: autoProtectionLabel,
          auto_parts_ask: autoPartsAsk,
          auto_parts_label: autoPartsLabel,
          exact_niche: exactNiche,
          niche_label: nicheLabel,
          vertical_hint: verticalHint ?? null,
          city: city.slug,
        },
      });
    }

    // Retry with nothing left: be honest rather than reshuffling the same cards.
    if (
      retry &&
      excludeSet.size > 0 &&
      composition.businesses.length === 0
    ) {
      const text =
        "I've already shown the strongest matches for that. Try a slightly different ask — a neighbourhood, vibe, or budget — and I'll dig further.";
      await finishLog({
        plan,
        businesses: [],
        composition: empty,
        llmInvoked: false,
      });
      return {
        plan,
        workflowId: plan.workflow,
        businesses: [],
        composition: empty,
        llmInvoked: false,
        clarification: false,
        stream: textStream(text),
        telemetry,
      };
    }

    const businesses = composition.businesses;

    if (queryTrace) {
      queryTrace.retrieval = {
        candidateCount: telemetry.candidateCount,
        retrievalMode: telemetry.retrievalMode,
      };
      queryTrace.composition = {
        strategy: composition.strategy,
        sectionCount: composition.sections.length,
        businessCount: businesses.length,
        sectionTitles: composition.sections.map((s) => s.title),
      };
      queryTrace.narration = {
        llmNarrate: Boolean(plan.llmRequired) && businesses.length > 0,
        deterministic: !plan.llmRequired || businesses.length === 0,
      };
    }

    // Fail closed: never narrate an empty candidate set (except pure general chat).
    // Product buys always fail closed — never invent a shopping list from thin air.
    const skipNarrationForEmpty =
      businesses.length === 0 &&
      (productAsk ||
        musicAsk ||
        autoProtectionAsk ||
        autoPartsAsk ||
        exactNiche ||
        exactIntent ||
        plan.responseMode !== "general_reply");

    if (!plan.llmRequired || skipNarrationForEmpty) {
      const text =
        businesses.length === 0
          ? productAsk && productLabel
            ? productEmptyMessage(productLabel)
            : musicAsk && musicLabel
              ? musicEmptyMessage(musicLabel)
              : autoProtectionAsk && autoProtectionLabel
                ? autoProtectionEmptyMessage(autoProtectionLabel)
                : autoPartsAsk && autoPartsLabel
                  ? autoPartsEmptyMessage(autoPartsLabel)
                  : exactNiche && nicheLabel
                    ? exactNicheEmptyMessage(nicheLabel)
                    : def.responseBehaviour.emptyResultsMessage
          : formatCompositionConversational(composition, {
              cityName: city.name,
              servicesTone:
                resolved.workflow === "services" ||
                resolved.workflow === "healthcare",
            }) ||
            businesses.map((b) => b.name).join(", ");
      telemetry.narrationSkipped = true;
      if (
        intelligenceFlags.answerCache() &&
        !bypassAnswerCache &&
        businesses.length > 0
      ) {
        const cacheKey = answerCacheKey({
          citySlug: city.slug,
          message: clean.sanitized,
          stickyHash,
          rankConfigVersion: getRankConfigVersion(),
        });
        await setCachedAnswer(cacheKey, {
          text,
          businesses,
          composition,
          planSnapshot: {
            workflow: plan.workflow,
            responseMode: plan.responseMode,
            llmRequired: false,
            intent: plan.intent,
            goal: plan.goal,
          },
          queryClass: telemetry.queryClass,
          cachedAt: new Date().toISOString(),
        });
      }
      await finishLog({
        plan,
        businesses,
        composition,
        llmInvoked: false,
      });
      return {
        plan,
        workflowId: plan.workflow,
        businesses,
        composition,
        llmInvoked: false,
        clarification: false,
        stream: textStream(text),
        telemetry,
        ...(queryTrace ? { queryTrace } : {}),
      };
    }

    telemetry.llmStages.narrate = true;
    telemetry.routePaths.push("llm_narrate");
    if (queryTrace) {
      queryTrace.narration = { llmNarrate: true, deterministic: false };
    }
    await finishLog({
      plan,
      businesses,
      composition,
      llmInvoked: true,
    });

    const productPromptHint = productAsk
      ? [
          "",
          "PRODUCT BUY ASK:",
          `- User wants to buy: ${productLabel ?? "a product"}.`,
          "- Recommend ONLY the listed electronics / computer / phone retailers (or shopping centres if RELATED MATCH).",
          "- Never suggest pets, entertainment, bakeries, auto repair, or unrelated leisure.",
          "- Do not invent stock — say who to call or visit to check.",
        ].join("\n")
      : "";

    const musicPromptHint = musicAsk
      ? [
          "",
          "MUSIC / INSTRUMENT ASK:",
          `- User needs: ${musicLabel ?? "music / instrument help"}.`,
          "- Recommend ONLY listed music shops or instrument services.",
          "- Never suggest car repair, tyres, locksmiths, surf shops, or unrelated trades.",
          "- If the list is empty, say so plainly — do not invent shops.",
        ].join("\n")
      : "";

    const autoProtectionPromptHint = autoProtectionAsk
      ? [
          "",
          "AUTO PAINT PROTECTION ASK:",
          `- User needs: ${autoProtectionLabel ?? "PPF / wrap / tint / detailing"}.`,
          "- Recommend ONLY listed PPF, wrap, tint, ceramic coating, or detailing specialists.",
          "- Never pad with unrelated tyre shops, general mechanics, or leisure.",
          "- If the list is empty, say so plainly — do not invent shops.",
        ].join("\n")
      : "";

    const autoPartsPromptHint = autoPartsAsk
      ? [
          "",
          "AUTO PARTS ASK:",
          `- User needs: ${autoPartsLabel ?? "auto parts"}.`,
          "- Recommend ONLY listed battery / auto-parts / tyre centres that stock parts.",
          "- Never pad with restaurants, spas, or unrelated leisure.",
          "- If the list is empty, say so plainly — do not invent shops.",
        ].join("\n")
      : "";

    const exactNichePromptHint =
      exactNiche &&
      !productAsk &&
      !musicAsk &&
      !autoProtectionAsk &&
      !autoPartsAsk
        ? [
            "",
            "EXACT NICHE ASK:",
            `- User needs: ${nicheLabel ?? "a specific local service"}.`,
            "- Recommend ONLY listed businesses that clearly fit that ask.",
            "- Never pad with unrelated trades, leisure, or 'ideas by vibe'.",
            "- If the list is empty, say so plainly.",
          ].join("\n")
        : "";

    const baseSystem = explain.buildSystemPrompt(city.name);
    const system = [
      baseSystem,
      weather?.promptHint,
      productPromptHint,
      musicPromptHint,
      autoProtectionPromptHint,
      autoPartsPromptHint,
      exactNichePromptHint,
    ]
      .filter(Boolean)
      .join("\n");

    const stream = streamWithGrounding(
      recommendationService.stream({
        system,
        userMessage: clean.sanitized,
        promptName: explain.promptName,
        history: modelHistory,
        composition,
        userId,
        conversationId,
      }),
      businesses,
      userId,
      conversationId,
    );

    return {
      plan,
      workflowId: plan.workflow,
      businesses,
      composition,
      llmInvoked: true,
      clarification: false,
      stream,
      telemetry,
      ...(queryTrace ? { queryTrace } : {}),
    };
  }

  async complete(params: ConversationParams): Promise<{
    plan: PlannerPlan;
    workflowId: PlannerPlan["workflow"];
    businesses: BusinessResult[];
    composition: ExperienceComposition;
    llmInvoked: boolean;
    clarification: boolean;
    text: string;
    telemetry: TurnTelemetry;
    queryTrace?: QueryTrace;
  }> {
    const result = await this.handle(params);
    let text = "";
    for await (const delta of result.stream) {
      text += delta;
    }
    const allowedIds = result.businesses.map((b) => b.id);
    return {
      plan: result.plan,
      workflowId: result.workflowId,
      businesses: result.businesses,
      composition: result.composition,
      llmInvoked: result.llmInvoked,
      clarification: result.clarification,
      text: scrubInvalidBizMarkers(text, allowedIds),
      telemetry: result.telemetry,
      ...(result.queryTrace ? { queryTrace: result.queryTrace } : {}),
    };
  }
}

export const conversationService = new ConversationService();
