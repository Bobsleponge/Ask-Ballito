import { normaliseGoalPrimary } from "@/config/goal-vocabulary";
import { buildCompositionRequest } from "@/services/composition/request";
import {
  DEFAULT_ACTIVITY_SEARCH_QUERIES,
  VAGUE_ACTIVITY_QUERY_RE,
} from "@/lib/business-vertical-filter";
import { getWorkflowDefinition } from "@/services/workflows/definitions";
import { adjustConfidence, confidenceBand, pickWorkflow } from "./confidence";
import { mergeConstraints, mergeEntities } from "./context";
import {
  isTradeOrAfterHoursServiceAsk,
  isAfterHoursWording,
  isHumanMedicalAsk,
  isOpenNowWording,
  isPetVetAsk,
  shouldTreatAsEmergency,
} from "./emergency-guard";
import { resolveHealthcareVerticalHint } from "./healthcare-vertical";
import { detectTradeKind, tradeResultsTitle, tradeLabel, tradeSearchQueries } from "./trade-query";
import {
  extractProductLabel,
  isProductPurchaseAsk,
  productSearchQueries,
} from "./product-intent";
import {
  extractMusicLabel,
  isMusicInstrumentAsk,
  musicSearchQueries,
} from "./music-intent";
import {
  extractExactNicheLabel,
  isExactNicheAsk,
} from "./exact-niche-guard";
import {
  celebrationTitleHint,
  enrichCelebrationFacets,
  executionPlanFromFacets,
  isAdultMilestoneAsk,
  isCelebrationAsk,
  isElevatedCelebrationAsk,
  isKidsCelebrationAsk,
  isProposalAsk,
  isSpecialOccasionGoal,
  sanitizePlanFacets,
} from "./special-occasion-intent";
import {
  detectMealTime,
  mealTimeSearchQueries,
} from "./meal-time-intent";
import { resolveServicesVerticalHint } from "./service-vertical";
import { parseDistanceLabel, resolveLocationRef } from "./location-ref";
import type {
  ConversationContext,
  ExecutionStep,
  FieldKey,
  PlanFacet,
  PlannerDraft,
  PlannerPlan,
  WorkflowDefinition,
} from "./types";
import { emptyConstraintFlags } from "./types";

function hasPlaceSignal(draft: PlannerDraft): boolean {
  return (
    draft.entities.businessTypes.length > 0 ||
    draft.entities.cuisines.length > 0 ||
    draft.draftQueries.some((q) =>
      /restaurant|cafe|coffee|dinner|lunch|brunch|food|eat|bar/i.test(q),
    )
  );
}

function extractTradeSearchHints(message: string): string[] {
  const kind = detectTradeKind(message);
  const hints: string[] = [];
  if (kind) {
    hints.push(tradeLabel(kind));
    if (isAfterHoursWording(message)) {
      for (const q of [
        `24 hour ${tradeLabel(kind)}`,
        `emergency ${tradeLabel(kind)}`,
        `${tradeLabel(kind)} call out`,
        `after hours ${tradeLabel(kind)}`,
      ]) {
        if (!hints.includes(q)) hints.push(q);
      }
    }
    return hints;
  }
  // Never seed generic "emergency call out" without a trade kind — that
  // previously ranked vet hospitals for "doctor open now".
  return hints;
}

function missingRequiredFields(
  def: WorkflowDefinition,
  draft: PlannerDraft,
): FieldKey[] {
  const missing: FieldKey[] = [];
  for (const field of def.requiredFields) {
    switch (field) {
      case "place_type":
      case "cuisine":
        if (!hasPlaceSignal(draft)) missing.push(field);
        break;
      case "stay_type":
        if (
          !draft.entities.businessTypes.some((t) =>
            /hotel|apartment|accommodation|stay/i.test(t),
          ) &&
          !draft.draftQueries.some((q) => /hotel|stay|apartment/i.test(q))
        ) {
          missing.push(field);
        }
        break;
      case "activity_hint":
        if (
          draft.entities.businessTypes.length === 0 &&
          draft.constraints.preferred.outdoorSeating == null &&
          draft.constraints.preferred.familyFriendly == null &&
          draft.draftQueries.length === 0
        ) {
          missing.push(field);
        }
        break;
      case "care_type":
        if (
          !draft.entities.businessTypes.some((t) =>
            /doctor|dentist|clinic|pharmacy|gp/i.test(t),
          ) &&
          draft.draftQueries.length === 0
        ) {
          missing.push(field);
        }
        break;
      case "service_type":
        if (
          draft.entities.businessTypes.length === 0 &&
          draft.draftQueries.length === 0
        ) {
          missing.push(field);
        }
        break;
      case "property_intent":
        if (
          draft.entities.estates.length === 0 &&
          !draft.entities.businessTypes.some((t) =>
            /estate|agent|property|rent|buy/i.test(t),
          ) &&
          draft.draftQueries.length === 0
        ) {
          missing.push(field);
        }
        break;
      default:
        break;
    }
  }
  return missing;
}

function activitySearchQueries(draft: PlannerDraft): string[] {
  const queries = draft.draftQueries.map((q) => q.trim()).filter(Boolean);
  const vague =
    queries.length === 0 ||
    queries.every((q) => VAGUE_ACTIVITY_QUERY_RE.test(q) && q.split(/\s+/).length <= 8);
  if (vague) return [...DEFAULT_ACTIVITY_SEARCH_QUERIES];
  return queries;
}

function buildExecutionPlan(
  def: WorkflowDefinition,
  draft: PlannerDraft,
  userMessage = "",
): ExecutionStep[] {
  if (def.id === "emergency") return def.defaultExecutionPlan.map((s) => ({ ...s }));

  const defaultParams = def.defaultExecutionPlan[0]?.params ?? {};
  let verticalHint =
    typeof defaultParams.verticalHint === "string"
      ? defaultParams.verticalHint
      : undefined;
  const defaultLimit =
    typeof defaultParams.limit === "number" ? defaultParams.limit : 12;

  if (def.id === "services") {
    const resolved = resolveServicesVerticalHint(userMessage, draft);
    verticalHint = resolved ?? undefined;
  }

  if (def.id === "healthcare") {
    const resolved = resolveHealthcareVerticalHint(userMessage, draft);
    verticalHint = resolved;
  }

  if (def.id === "activities") {
    const queries = activitySearchQueries(draft);
    return queries.map((query, i) => ({
      id: `activities_${i}`,
      capability: "business_search" as const,
      type: "business_search" as const,
      query,
      params: {
        limit: defaultLimit,
        verticalHint: verticalHint ?? "attractions",
      },
      priority: i + 1,
      optional: false,
    }));
  }

  if (def.id === "special_occasion") {
    const facets = sanitizePlanFacets(draft.planFacets);
    if (facets.length >= 2) return executionPlanFromFacets(facets);
    // Soft fallback — goal description search, not jewellery checklist.
    const q =
      draft.goal.description?.trim() ||
      draft.draftQueries[0]?.trim() ||
      userMessage.trim() ||
      "celebration venues Ballito";
    return [
      {
        id: "celebration_fallback",
        capability: "business_search" as const,
        type: "business_search" as const,
        query: q,
        params: { limit: 20 },
        priority: 1,
        optional: false,
      },
    ];
  }

  if (draft.draftQueries.length > 0 && def.id !== "relocation") {
    return draft.draftQueries.map((query, i) => ({
      id: `draft_${i}`,
      capability: "business_search" as const,
      type: "business_search" as const,
      query,
      params: {
        limit: defaultLimit,
        ...(verticalHint ? { verticalHint } : {}),
      },
      priority: i + 1,
      optional: false,
    }));
  }

  if (def.id === "relocation") {
    const base = def.defaultExecutionPlan.map((s) => ({ ...s }));
    draft.draftQueries.forEach((query, i) => {
      base.push({
        id: `draft_${i}`,
        capability: "business_search",
        type: "business_search",
        query,
        params: { limit: 8 },
        priority: 100 + i,
        optional: true,
      });
    });
    return base;
  }

  if (def.id === "services") {
    return [
      {
        id: "services_search",
        capability: "business_search",
        type: "business_search",
        query:
          draft.draftQueries[0]?.trim() ||
          draft.goal.description?.trim() ||
          userMessage.trim() ||
          "professional services",
        params: {
          limit: defaultLimit,
          ...(verticalHint ? { verticalHint } : {}),
        },
        priority: 1,
        optional: false,
      },
    ];
  }

  return def.defaultExecutionPlan.map((s) => ({ ...s }));
}

/**
 * Deterministic resolver: turns PlannerDraft + ConversationContext into PlannerPlan.
 */
export function resolvePlannerPlan(
  draft: PlannerDraft,
  context: ConversationContext,
  userMessage = "",
): PlannerPlan {
  const rulesApplied: string[] = [];
  const { confidence, rules: confRules } = adjustConfidence(draft);
  rulesApplied.push(...confRules);

  const goal = {
    primary: normaliseGoalPrimary(draft.goal.primary),
    description: draft.goal.description,
  };

  const messageForGuard = [
    userMessage,
    draft.goal.description,
    draft.intent,
    ...draft.draftQueries,
    ...draft.entities.businessTypes,
  ]
    .filter(Boolean)
    .join(" ");

  let emergencyFlag = draft.constraints.emergency;
  if (
    emergencyFlag === true &&
    !shouldTreatAsEmergency(messageForGuard, emergencyFlag)
  ) {
    emergencyFlag = false;
    rulesApplied.push("emergency_cleared_trade_or_after_hours");
  }

  let { workflow, rejected, rules: wfRules } = pickWorkflow(
    draft.candidateWorkflows,
    emergencyFlag,
  );
  rulesApplied.push(...wfRules);

  // After clearing a false emergency, prefer services for trade/after-hours asks.
  // Never hijack human medical asks into unfiltered trade/call-out search.
  if (
    emergencyFlag !== true &&
    !isHumanMedicalAsk(messageForGuard) &&
    isTradeOrAfterHoursServiceAsk(messageForGuard) &&
    (workflow === "emergency" ||
      workflow === "general" ||
      workflow === "healthcare")
  ) {
    rejected = [workflow, ...rejected.filter((w) => w !== "services")];
    workflow = "services";
    rulesApplied.push("force_services_for_trade_ask");
  }

  // Human medical (non-crisis) must stay on healthcare — not services/general.
  if (
    emergencyFlag !== true &&
    isHumanMedicalAsk(messageForGuard) &&
    !isPetVetAsk(messageForGuard) &&
    (workflow === "services" ||
      workflow === "general" ||
      workflow === "emergency" ||
      workflow === "activities")
  ) {
    rejected = [workflow, ...rejected.filter((w) => w !== "healthcare")];
    workflow = "healthcare";
    rulesApplied.push("force_healthcare_for_medical_ask");
  }

  // Product / buy asks must not land in leisure "vibe" browsing.
  const productAsk = isProductPurchaseAsk(messageForGuard);
  if (
    productAsk &&
    (workflow === "activities" ||
      workflow === "restaurants" ||
      workflow === "accommodation" ||
      workflow === "healthcare" ||
      workflow === "emergency")
  ) {
    rejected = [workflow, ...rejected.filter((w) => w !== "general")];
    workflow = "general";
    rulesApplied.push("force_general_for_product_ask");
  } else if (productAsk) {
    rulesApplied.push("product_purchase_ask");
  }

  // Music / instrument asks → services with music-instruments vertical.
  const musicAsk = !productAsk && isMusicInstrumentAsk(messageForGuard);
  if (
    musicAsk &&
    (workflow === "activities" ||
      workflow === "restaurants" ||
      workflow === "accommodation" ||
      workflow === "healthcare" ||
      workflow === "emergency" ||
      workflow === "general" ||
      workflow === "relocation" ||
      workflow === "special_occasion")
  ) {
    rejected = [workflow, ...rejected.filter((w) => w !== "services")];
    workflow = "services";
    rulesApplied.push("force_services_for_music_ask");
  } else if (musicAsk) {
    rulesApplied.push("music_instrument_ask");
  }

  // Celebration / event planning when the planner supplied dynamic facets.
  const planFacets = enrichCelebrationFacets(
    sanitizePlanFacets(draft.planFacets),
    messageForGuard,
  );
  const celebrationAsk =
    !productAsk &&
    !musicAsk &&
    (planFacets.length >= 2 ||
      (isCelebrationAsk(messageForGuard) && planFacets.length >= 1) ||
      (isSpecialOccasionGoal(goal.primary) && planFacets.length >= 2));
  if (
    celebrationAsk &&
    workflow !== "emergency" &&
    workflow !== "special_occasion"
  ) {
    rejected = [workflow, ...rejected.filter((w) => w !== "special_occasion")];
    workflow = "special_occasion";
    rulesApplied.push("force_special_occasion_facets");
  } else if (celebrationAsk) {
    rulesApplied.push("celebration_facets");
  } else if (
    isSpecialOccasionGoal(goal.primary) &&
    planFacets.length < 2 &&
    workflow === "special_occasion"
  ) {
    // Bare celebration goal without facets → leisure activities, not proposal template.
    rejected = [workflow, ...rejected.filter((w) => w !== "activities")];
    workflow = "activities";
    rulesApplied.push("special_occasion_without_facets_to_activities");
  }

  // Generic exact niche (unknown verticals included): leave leisure browsing.
  const exactNiche =
    !productAsk &&
    !musicAsk &&
    !celebrationAsk &&
    isExactNicheAsk(messageForGuard);
  if (
    exactNiche &&
    (workflow === "activities" ||
      workflow === "relocation" ||
      workflow === "special_occasion")
  ) {
    rejected = [workflow, ...rejected.filter((w) => w !== "services")];
    workflow = "services";
    rulesApplied.push("force_services_for_exact_niche");
  } else if (exactNiche) {
    rulesApplied.push("exact_niche_ask");
  }

  const def = getWorkflowDefinition(workflow);
  const { merged: entities, stickyUsed } = mergeEntities(
    context.stickyEntities,
    draft.entities,
  );
  if (stickyUsed) rulesApplied.push("sticky_entities_merged");

  // Ensure trade asks have searchable needles even if the LLM only flagged emergency.
  if (
    workflow === "services" &&
    (isTradeOrAfterHoursServiceAsk(messageForGuard) ||
      detectTradeKind(messageForGuard) != null)
  ) {
    const tradeHints = extractTradeSearchHints(messageForGuard);
    for (const hint of tradeHints) {
      if (
        !entities.businessTypes.some(
          (t) => t.toLowerCase() === hint.toLowerCase(),
        )
      ) {
        // Keep entity types short (trade label only) — long search phrases go in draftQueries.
        if (!/\s/.test(hint) || hint.split(/\s+/).length <= 3) {
          entities.businessTypes.push(hint);
        }
      }
    }
    // Always merge trade search queries (don't wait for empty draftQueries).
    const kind = detectTradeKind(messageForGuard);
    const seededQueries = kind
      ? tradeSearchQueries(kind, messageForGuard, "Ballito")
      : tradeHints.map((hint) => `${hint} Ballito`);
    let seeded = 0;
    for (const q of seededQueries) {
      if (
        !draft.draftQueries.some(
          (existing) => existing.toLowerCase() === q.toLowerCase(),
        )
      ) {
        draft.draftQueries.push(q);
        seeded += 1;
      }
    }
    if (seeded > 0) rulesApplied.push("seed_trade_draft_queries");
  }

  // Human medical asks: seed doctor/hospital needles and drop trade call-out junk.
  if (workflow === "healthcare" && isHumanMedicalAsk(messageForGuard)) {
    const careHint = resolveHealthcareVerticalHint(
      messageForGuard,
      draft,
    );
    const medicalSeeds =
      careHint === "hospitals"
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
    // Drop typo/raw user phrasing and vet/call-out junk — embeddings won't match
    // "docotor open noq" to real clinics.
    draft.draftQueries = [
      ...medicalSeeds,
      ...draft.draftQueries.filter(
        (q) =>
          !/emergency\s+call[\s-]?out|call[\s-]?out\s+service/i.test(q) &&
          !/\bvet(?:erinar)?\b/i.test(q) &&
          !/docotor|docter|doctar|\bnoq\b/i.test(q) &&
          !medicalSeeds.some(
            (seed) => seed.toLowerCase() === q.toLowerCase(),
          ),
      ),
    ].slice(0, 8);
    if (
      !entities.businessTypes.some((t) =>
        /doctor|gp|clinic|hospital|medical/i.test(t),
      )
    ) {
      entities.businessTypes.push(
        careHint === "hospitals" ? "hospital" : "doctor",
        "medical clinic",
      );
    }
    rulesApplied.push("seed_healthcare_draft_queries");
  }

  // Seed electronics / product retail queries for buy asks.
  if (productAsk) {
    const productLabel = extractProductLabel(messageForGuard);
    const seededQueries = productSearchQueries(productLabel, "Ballito");
    let seeded = 0;
    for (const q of seededQueries) {
      if (
        !draft.draftQueries.some(
          (existing) => existing.toLowerCase() === q.toLowerCase(),
        )
      ) {
        draft.draftQueries.push(q);
        seeded += 1;
      }
    }
    if (
      !entities.businessTypes.some((t) =>
        /electronics|computer|phone|shopping/i.test(t),
      )
    ) {
      entities.businessTypes.push("electronics store", "computer shop");
    }
    if (seeded > 0) rulesApplied.push("seed_product_draft_queries");
  }

  if (musicAsk) {
    const musicLabel = extractMusicLabel(messageForGuard);
    const seededQueries = musicSearchQueries(musicLabel, "Ballito");
    let seeded = 0;
    for (const q of seededQueries) {
      if (
        !draft.draftQueries.some(
          (existing) => existing.toLowerCase() === q.toLowerCase(),
        )
      ) {
        draft.draftQueries.push(q);
        seeded += 1;
      }
    }
    if (
      !entities.businessTypes.some((t) =>
        /music|guitar|instrument/i.test(t),
      )
    ) {
      entities.businessTypes.push("music shop", "guitar shop");
    }
    if (seeded > 0) rulesApplied.push("seed_music_draft_queries");
  }

  if (exactNiche && draft.draftQueries.length === 0) {
    const label = extractExactNicheLabel(messageForGuard);
    draft.draftQueries.push(
      `${label} Ballito`,
      messageForGuard.trim().slice(0, 120),
    );
    rulesApplied.push("seed_exact_niche_draft_queries");
  }

  // Seed activity type needles so ranking typeBoost actually moves the needle.
  if (
    workflow === "activities" &&
    entities.businessTypes.length === 0 &&
    entities.cuisines.length === 0
  ) {
    entities.businessTypes.push(
      "attraction",
      "beach",
      "tour",
      "activity",
      "outdoor",
      "family",
    );
    rulesApplied.push("seed_activity_business_types");
  }

  if (celebrationAsk || workflow === "special_occasion") {
    for (const facet of planFacets) {
      const needle = facet.label.slice(0, 40);
      if (
        needle &&
        !entities.businessTypes.some(
          (t) => t.toLowerCase() === needle.toLowerCase(),
        )
      ) {
        entities.businessTypes.push(needle);
      }
    }
    if (planFacets.length > 0) {
      rulesApplied.push("seed_celebration_facet_business_types");
    }
  }

  const constraints = mergeConstraints(context.stickyConstraints, {
    ...draft.constraints,
    emergency: emergencyFlag,
    preferred: { ...emptyConstraintFlags(), ...draft.constraints.preferred },
    required: { ...emptyConstraintFlags(), ...draft.constraints.required },
    avoid: { ...emptyConstraintFlags(), ...draft.constraints.avoid },
  });
  if (
    (context.stickyConstraints.openNow != null &&
      draft.constraints.openNow == null) ||
    (context.stickyConstraints.budget != null &&
      draft.constraints.budget == null) ||
    (context.stickyConstraints.partySize != null &&
      draft.constraints.partySize == null)
  ) {
    rulesApplied.push("sticky_constraints_merged");
  }

  if (
    (celebrationAsk || workflow === "special_occasion") &&
    isKidsCelebrationAsk(messageForGuard)
  ) {
    if (constraints.preferred.familyFriendly == null) {
      constraints.preferred.familyFriendly = true;
      rulesApplied.push("infer_family_kids_celebration");
    }
    if (constraints.preferred.kidsArea == null) {
      constraints.preferred.kidsArea = true;
    }
  } else if (
    (celebrationAsk || workflow === "special_occasion") &&
    isProposalAsk(messageForGuard) &&
    constraints.preferred.romantic == null
  ) {
    constraints.preferred.romantic = true;
    rulesApplied.push("infer_romantic_proposal");
  } else if (
    (celebrationAsk || workflow === "special_occasion") &&
    /anniversary/i.test(messageForGuard) &&
    constraints.preferred.romantic == null &&
    !isKidsCelebrationAsk(messageForGuard)
  ) {
    constraints.preferred.romantic = true;
    rulesApplied.push("infer_romantic_anniversary");
  }

  // Adult milestone / elevated celebration → prefer nicer dining register.
  // Override planner "mid"/family defaults that pull casual chains (e.g. Steers).
  if (
    (celebrationAsk || workflow === "special_occasion") &&
    isElevatedCelebrationAsk(messageForGuard)
  ) {
    if (
      constraints.budget == null ||
      constraints.budget === "mid" ||
      constraints.budget === "budget"
    ) {
      constraints.budget = "upscale";
      rulesApplied.push("infer_upscale_elevated_celebration");
    }
    if (isAdultMilestoneAsk(messageForGuard)) {
      if (constraints.preferred.familyFriendly === true) {
        constraints.preferred.familyFriendly = null;
        rulesApplied.push("clear_family_for_adult_milestone");
      }
      if (constraints.preferred.kidsArea === true) {
        constraints.preferred.kidsArea = null;
      }
    }
  }

  // "Open now" / after-hours urgency — set for any vertical, not only trades.
  if (isOpenNowWording(messageForGuard) && constraints.openNow == null) {
    constraints.openNow = true;
    rulesApplied.push(
      isTradeOrAfterHoursServiceAsk(messageForGuard)
        ? "infer_open_now_after_hours_trade"
        : "infer_open_now_from_phrasing",
    );
  }

  // Breakfast / lunch / dinner — deterministic meal-time preference + search seeds.
  const mealTime = detectMealTime(messageForGuard);
  if (mealTime === "breakfast" && constraints.preferred.breakfast == null) {
    constraints.preferred.breakfast = true;
    rulesApplied.push("infer_breakfast");
  } else if (mealTime === "lunch" && constraints.preferred.lunch == null) {
    constraints.preferred.lunch = true;
    rulesApplied.push("infer_lunch");
  } else if (mealTime === "dinner" && constraints.preferred.dinner == null) {
    constraints.preferred.dinner = true;
    rulesApplied.push("infer_dinner");
  }
  if (mealTime) {
    if (
      mealTime === "breakfast" &&
      !entities.cuisines.some((c) => /breakfast|brunch/i.test(c))
    ) {
      entities.cuisines.push("breakfast");
    }
    const seeds = mealTimeSearchQueries(mealTime, "Ballito");
    for (const q of seeds) {
      if (
        !draft.draftQueries.some(
          (existing) => existing.toLowerCase() === q.toLowerCase(),
        )
      ) {
        draft.draftQueries.unshift(q);
      }
    }
    rulesApplied.push(`seed_meal_time_queries_${mealTime}`);
  }

  if (constraints.distanceLabel && constraints.distanceMeters == null) {
    constraints.distanceMeters = parseDistanceLabel(constraints.distanceLabel);
  }

  if (
    entities.people.some((p) => /family|kid|child/i.test(p)) &&
    constraints.preferred.familyFriendly == null &&
    !isAdultMilestoneAsk(messageForGuard)
  ) {
    constraints.preferred.familyFriendly = true;
    rulesApplied.push("infer_family_from_people");
  }

  const locationRef = resolveLocationRef(entities, context.stickyEntities);
  if (locationRef) rulesApplied.push(`location_ref_${locationRef.source}`);

  const draftForFields = { ...draft, entities };
  const missing = missingRequiredFields(def, draftForFields);
  const band = confidenceBand(confidence);
  let executionPlan = buildExecutionPlan(
    def,
    draftForFields,
    messageForGuard,
  );
  if (productAsk) {
    // Always retrieve against shopping — never FAQ-only for a buy ask.
    const productLabel = extractProductLabel(messageForGuard);
    const queries =
      draftForFields.draftQueries.length > 0
        ? draftForFields.draftQueries
        : productSearchQueries(productLabel, "Ballito");
    executionPlan = queries.slice(0, 8).map((query, i) => ({
      id: `product_${i}`,
      capability: "business_search" as const,
      type: "business_search" as const,
      query,
      params: { limit: 20, verticalHint: "electronics" },
      priority: i + 1,
      optional: false,
    }));
    rulesApplied.push("product_execution_electronics");
  } else if (musicAsk) {
    const musicLabel = extractMusicLabel(messageForGuard);
    const queries =
      draftForFields.draftQueries.length > 0
        ? draftForFields.draftQueries
        : musicSearchQueries(musicLabel, "Ballito");
    executionPlan = queries.slice(0, 6).map((query, i) => ({
      id: `music_${i}`,
      capability: "business_search" as const,
      type: "business_search" as const,
      query,
      params: { limit: 20, verticalHint: "music-instruments" },
      priority: i + 1,
      optional: false,
    }));
    rulesApplied.push("music_execution_instruments");
  } else if (celebrationAsk || workflow === "special_occasion") {
    const facets =
      planFacets.length >= 1
        ? planFacets
        : sanitizePlanFacets(draft.planFacets);
    if (facets.length >= 1) {
      executionPlan = executionPlanFromFacets(facets);
      rulesApplied.push("celebration_facet_execution");
    } else {
      executionPlan = [
        {
          id: "celebration_fallback",
          capability: "business_search" as const,
          type: "business_search" as const,
          query:
            goal.description.trim() ||
            messageForGuard.trim().slice(0, 120) ||
            "celebration Ballito",
          params: { limit: 20 },
          priority: 1,
          optional: false,
        },
      ];
      rulesApplied.push("celebration_fallback_execution");
    }
  } else if (workflow === "services") {
    const hint = resolveServicesVerticalHint(messageForGuard, draftForFields);
    rulesApplied.push(
      hint
        ? `services_vertical_${hint}`
        : "services_vertical_unfiltered",
    );
  } else if (workflow === "healthcare") {
    const hint = resolveHealthcareVerticalHint(messageForGuard, draftForFields);
    rulesApplied.push(`healthcare_vertical_${hint}`);
  }

  let clarify = false;
  if (workflow === "emergency" || workflow === "special_occasion") {
    clarify = false;
  } else if (
    band === "low" &&
    !hasPlaceSignal(draftForFields) &&
    workflow !== "relocation" &&
    workflow !== "general"
  ) {
    clarify = true;
    rulesApplied.push("clarify_low_confidence");
  } else if (
    missing.length > 0 &&
    !def.responseBehaviour.allowExecuteWithoutRequired &&
    draft.draftQueries.length === 0 &&
    !hasPlaceSignal(draftForFields)
  ) {
    clarify = true;
    rulesApplied.push("clarify_missing_required");
  } else if (
    workflow === "general" &&
    band === "low" &&
    /somewhere nice|anything nice/i.test(goal.description)
  ) {
    clarify = true;
    rulesApplied.push("clarify_vague_general");
  }

  const clarificationQuestion = clarify
    ? (def.clarify[missing[0] ?? def.requiredFields[0] ?? "place_type"] ??
      "What are you looking for in Ballito?")
    : null;

  let responseMode: PlannerPlan["responseMode"] = "execute_and_explain";
  let llmRequired = true;

  if (clarify) {
    responseMode = "clarify";
    llmRequired = false;
  } else if (workflow === "emergency") {
    responseMode = "fast_path";
    llmRequired = false;
  } else if (
    workflow === "general" &&
    draft.draftQueries.length === 0 &&
    !productAsk &&
    !musicAsk
  ) {
    responseMode = "general_reply";
    llmRequired = true;
  } else {
    responseMode = "execute_and_explain";
    llmRequired = true;
  }

  const { request: compositionRequest, rules: compositionRules } =
    buildCompositionRequest({
      goalPrimary: goal.primary,
      goalDescription: goal.description,
      intent: draft.intent,
      workflowId: workflow,
      defaultStrategy: def.defaultCompositionStrategy ?? "ranked_list",
      entities,
      constraints,
      locationRef,
      planFacets,
    });
  rulesApplied.push(...compositionRules);

  let composition = compositionRequest;
  const tradeKind = detectTradeKind(messageForGuard);
  if (workflow === "services" && tradeKind) {
    composition = {
      ...compositionRequest,
      strategy: "ranked_list",
      titleHint: tradeResultsTitle(tradeKind, constraints.openNow === true),
      maxSections: 1,
      maxItemsPerSection: 10,
      sectionHints: [],
      bucketProfile: undefined,
    };
    rulesApplied.push("trade_composition_tight");
  } else if (productAsk) {
    const productLabel = extractProductLabel(messageForGuard);
    composition = {
      ...compositionRequest,
      strategy: "ranked_list",
      titleHint:
        productLabel === "that product"
          ? "Where to buy"
          : `Where to buy ${productLabel}`,
      maxSections: 1,
      maxItemsPerSection: 10,
      sectionHints: [],
      bucketProfile: undefined,
    };
    rulesApplied.push("product_composition_ranked");
  } else if (musicAsk) {
    const musicLabel = extractMusicLabel(messageForGuard);
    composition = {
      ...compositionRequest,
      strategy: "ranked_list",
      titleHint: musicLabel,
      maxSections: 1,
      maxItemsPerSection: 10,
      sectionHints: [],
      bucketProfile: undefined,
    };
    rulesApplied.push("music_composition_ranked");
  } else if (celebrationAsk || workflow === "special_occasion") {
    const facetsForComp: PlanFacet[] =
      planFacets.length > 0 ? planFacets : sanitizePlanFacets(draft.planFacets);
    composition = {
      ...compositionRequest,
      strategy: "grouped_sections",
      titleHint: celebrationTitleHint(
        messageForGuard,
        goal.description,
        goal.primary,
      ),
      maxSections: Math.min(6, Math.max(3, facetsForComp.length || 4)),
      maxItemsPerSection: 8,
      sectionHints: facetsForComp.map((f) => ({
        id: f.id,
        title: f.label,
        kind: "list" as const,
      })),
      bucketProfile: facetsForComp.length >= 1 ? "plan_facets" : "activities",
      planFacets: facetsForComp,
    };
    rulesApplied.push("celebration_facet_composition");
  } else if (exactNiche) {
    composition = {
      ...compositionRequest,
      strategy: "ranked_list",
      titleHint: extractExactNicheLabel(messageForGuard),
      maxSections: 1,
      maxItemsPerSection: 10,
      sectionHints: [],
      bucketProfile: undefined,
    };
    rulesApplied.push("exact_niche_composition_ranked");
  }

  return {
    version: "v2",
    intent: draft.intent,
    goal,
    workflow,
    confidence,
    entities,
    constraints,
    missingInformation: missing,
    needsClarification: clarify,
    clarificationQuestion,
    executionPlan: clarify ? [] : executionPlan,
    llmRequired,
    responseMode,
    locationRef,
    composition,
    diagnostics: {
      extractorConfidence: draft.confidence,
      rejectedWorkflows: rejected,
      rulesApplied,
      stickyEntitiesUsed: stickyUsed,
    },
  };
}
