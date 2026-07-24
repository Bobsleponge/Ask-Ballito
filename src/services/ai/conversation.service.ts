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
  buildConversationContext,
  parseStickySummary,
  plannerExtractorService,
  resolvePlannerPlan,
  FALLBACK_DRAFT,
  detectMealTime,
  type PlannerPlan,
} from "@/services/planner";
import {
  composeExperience,
  emptyComposition,
  formatCompositionPlain,
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
  applyAskFitToComposition,
  exactNicheEmptyMessage,
  extractExactNicheLabel,
  filterByAskFit,
  isExactNicheAsk,
} from "@/services/planner/exact-niche-guard";
import {
  filterCelebrationAudienceNoise,
  filterElevatedCasualDining,
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

export interface ConversationParams {
  city: City;
  message: string;
  history?: ChatMessage[];
  userId?: string | null;
  conversationId?: string | null;
  /** Ids to omit from the returned recommendation set. */
  excludeBusinessIds?: string[];
  retry?: boolean;
}

export interface ConversationResult {
  plan: PlannerPlan;
  workflowId: PlannerPlan["workflow"];
  businesses: BusinessResult[];
  composition: ExperienceComposition;
  llmInvoked: boolean;
  clarification: boolean;
  stream: AsyncGenerator<string, void, unknown>;
}

async function* textStream(text: string): AsyncGenerator<string, void, unknown> {
  yield text;
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
}) {
  captureServerEvent({
    distinctId: opts.userId ?? "anonymous",
    event: "composition_strategy",
    properties: {
      strategy: opts.composition.strategy,
      workflow: opts.plan.workflow,
      business_count: opts.businesses.length,
      llm_invoked: opts.llmInvoked,
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
    input: { message: opts.message, city: opts.plan.workflow },
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
 * sanitize → context → extract → resolve → capabilities → rank → compose → explain
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
    } = params;
    const start = Date.now();
    const clean = sanitizeUserInput(message);
    const excludeSet = new Set(
      excludeBusinessIds.map((id) => id.trim()).filter(Boolean),
    );

    const withoutExcluded = (list: BusinessResult[]) =>
      excludeSet.size === 0
        ? list
        : list.filter((b) => !excludeSet.has(b.id));

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
      await logAiCall({
        service: "ConversationOrchestrator",
        promptVersion: null,
        model: null,
        input: {
          message: clean.sanitized,
          flagged: true,
          reasons: clean.reasons,
        },
        output: { blocked: true },
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

    const context = buildConversationContext({
      city,
      history: contextHistory,
      stickySummary,
    });
    const draft = await plannerExtractorService.extract({
      context,
      message: clean.sanitized,
      userId,
      conversationId,
    });
    const resolved = resolvePlannerPlan(draft, context, clean.sanitized);
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
      await logOrchestration({
        userId,
        conversationId,
        plan,
        businesses: [],
        composition: empty,
        llmInvoked: false,
        latencyMs: Date.now() - start,
        message: clean.sanitized,
      });
      return {
        plan,
        workflowId: plan.workflow,
        businesses: [],
        composition: empty,
        llmInvoked: false,
        clarification: true,
        stream: textStream(text),
      };
    }

    const execution = await runExecutionPlan({
      plan,
      city,
      message: clean.sanitized,
    });

    if (
      plan.responseMode === "fast_path" ||
      (execution.fastPathText &&
        (plan.workflow === "emergency" ||
          (plan.workflow === "general" && execution.businesses.length === 0)))
    ) {
      const text =
        execution.fastPathText ??
        def.responseBehaviour.emptyResultsMessage;
      await logOrchestration({
        userId,
        conversationId,
        plan,
        businesses: [],
        composition: empty,
        llmInvoked: false,
        latencyMs: Date.now() - start,
        message: clean.sanitized,
      });
      return {
        plan,
        workflowId: plan.workflow,
        businesses: [],
        composition: empty,
        llmInvoked: false,
        clarification: false,
        stream: textStream(text),
      };
    }

    const rankConfig = {
      ...def.rankConfig,
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
    const exactNiche =
      !productAsk &&
      !musicAsk &&
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
    const hasDiningFacets = planFacets.some(isDiningPlanFacet);
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
      !exactNiche &&
      !specialOccasion &&
      !medicalCareAsk &&
      !mealTimeAsk &&
      (plan.composition.strategy === "grouped_sections" ||
        plan.composition.strategy === "ranked_list" ||
        plan.composition.strategy === "itinerary" ||
        plan.composition.strategy === "comparison" ||
        excludeSet.size > 0);

    if (productAsk && productLabel) {
      const queries = productSearchQueries(productLabel, city.name);
      const extras = await Promise.all(
        queries.map((query) =>
          businessSearchService.search({ city, query, limit: 25 }),
        ),
      );
      candidates = mergeBusinessesBySimilarity([
        candidates,
        ...extras.map(withoutExcluded),
      ]);
      candidates = filterProductSpecialists(candidates);
    } else if (musicAsk && musicLabel) {
      const queries = musicSearchQueries(musicLabel, city.name);
      const extras = await Promise.all(
        queries.map((query) =>
          businessSearchService.search({ city, query, limit: 25 }),
        ),
      );
      candidates = mergeBusinessesBySimilarity([
        candidates,
        ...extras.map(withoutExcluded),
      ]);
      candidates = filterMusicSpecialists(candidates);
    } else if (specialOccasion && hasDiningFacets) {
      const diningFacets = planFacets.filter(isDiningPlanFacet);
      const extras = await Promise.all(
        diningFacets.map(async (facet) => {
          const raw = await businessSearchService.search({
            city,
            query: facet.searchQuery,
            limit: 40,
          });
          return raw.map((b) => withPlanFacet(b, facet.id, facet.label));
        }),
      );
      candidates = mergeBusinessesBySimilarity([
        candidates,
        ...extras.map(withoutExcluded),
      ]);
    } else if (wantsVariety) {
      const extra = await businessSearchService.search({
        city,
        query: clean.sanitized,
        limit: 40,
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
          businessSearchService.search({ city, query, limit: 25 }),
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
          businessSearchService.search({ city, query, limit: 25 }),
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
      candidates = filterCelebrationAudienceNoise(candidates, {
        familyFriendly: plan.constraints.preferred.familyFriendly,
        romantic: plan.constraints.preferred.romantic,
        kidsAsk: plan.constraints.preferred.kidsArea === true,
        facets: planFacets,
      });
    }

    const verticalHint = rankConfig.verticalHint;
    const exactIntent =
      tradeKind != null ||
      productAsk ||
      musicAsk ||
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
      ranked = rankBusinesses(candidates, plan, {
        ...rankConfig,
        preferVariety: wantsVariety && !exactIntent && !specialOccasion,
        weatherBias: plan.composition.weatherBias ?? null,
        limit: urgentTrade
          ? Math.min(rankConfig.limit ?? 25, tradeLimit ?? 10)
          : productAsk || musicAsk || exactNiche
            ? Math.min(rankConfig.limit ?? 25, 10)
            : specialOccasion
              ? Math.max(rankConfig.limit ?? 24, 40)
              : rankConfig.limit,
        // Never force weak/off-trade fillers for exact service / product asks.
        // minKeep: 0 disables the default floor fill (ranking defaults to 6).
        minKeep: exactIntent
          ? 0
          : medicalCareAsk
            ? 4
            : specialOccasion
              ? 12
              : urgentTrade
                ? 3
                : undefined,
        relativeFloor: exactIntent
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
      });
    }

    if (productAsk) {
      ranked = enforceProductAskFit(ranked, "exact");
    }
    if (musicAsk) {
      ranked = filterMusicSpecialists(ranked);
    }
    if (specialOccasion) {
      ranked = filterCelebrationAudienceNoise(ranked, {
        familyFriendly: plan.constraints.preferred.familyFriendly,
        romantic: plan.constraints.preferred.romantic,
        kidsAsk: plan.constraints.preferred.kidsArea === true,
        facets: planFacets,
      });
      ranked = filterElevatedCasualDining(ranked, {
        elevated: isElevatedCelebrationAsk(clean.sanitized),
        facets: planFacets,
      });
    }
    // Generic exact niche ask-fit (also tightens trade leftovers).
    // Skip for healthcare — typo asks like "docotor open noq" have needles
    // that never appear on GP listings and wipe the whole result set.
    if (
      exactIntent &&
      !productAsk &&
      !musicAsk &&
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
        draftQueries: draft.draftQueries,
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

    // Final ask-fit for generic exact niches (product/music use specialist gates).
    // Never ask-fit healthcare — typo tokens wipe real GPs/clinics.
    if (
      exactIntent &&
      !productAsk &&
      !musicAsk &&
      plan.workflow !== "healthcare" &&
      !isHumanMedicalAsk(clean.sanitized) &&
      composition.grounding?.mode !== "related"
    ) {
      composition = applyAskFitToComposition(composition, clean.sanitized);
    }

    // Gated LLM fit verification for multi-part celebrations (not basic asks).
    const fitGate = shouldFitVerify({
      userMessage: clean.sanitized,
      plan,
      composition,
    });
    if (fitGate.run) {
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
      await logOrchestration({
        userId,
        conversationId,
        plan,
        businesses: [],
        composition: empty,
        llmInvoked: false,
        latencyMs: Date.now() - start,
        message: clean.sanitized,
      });
      return {
        plan,
        workflowId: plan.workflow,
        businesses: [],
        composition: empty,
        llmInvoked: false,
        clarification: false,
        stream: textStream(text),
      };
    }

    const businesses = composition.businesses;

    // Fail closed: never narrate an empty candidate set (except pure general chat).
    // Product buys always fail closed — never invent a shopping list from thin air.
    const skipNarrationForEmpty =
      businesses.length === 0 &&
      (productAsk ||
        musicAsk ||
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
              : exactNiche && nicheLabel
                ? exactNicheEmptyMessage(nicheLabel)
                : def.responseBehaviour.emptyResultsMessage
          : formatCompositionPlain(composition) ||
            businesses.map((b) => b.name).join(", ");
      await logOrchestration({
        userId,
        conversationId,
        plan,
        businesses,
        composition,
        llmInvoked: false,
        latencyMs: Date.now() - start,
        message: clean.sanitized,
      });
      return {
        plan,
        workflowId: plan.workflow,
        businesses,
        composition,
        llmInvoked: false,
        clarification: false,
        stream: textStream(text),
      };
    }

    await logOrchestration({
      userId,
      conversationId,
      plan,
      businesses,
      composition,
      llmInvoked: true,
      latencyMs: Date.now() - start,
      message: clean.sanitized,
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

    const exactNichePromptHint =
      exactNiche && !productAsk && !musicAsk
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
    };
  }
}

export const conversationService = new ConversationService();
