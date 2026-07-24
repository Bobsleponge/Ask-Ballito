import type { City } from "@/config/cities";
import type { ChatMessage } from "@/lib/schemas/chat";
import type { RankConfig } from "@/services/ai/ranking.engine";
import type {
  CompositionRequest,
  PresentationStrategy,
} from "@/services/composition/types";

/** Extensible workflow ids including emergency as first-class. */
export type WorkflowId =
  | "restaurants"
  | "activities"
  | "property"
  | "services"
  | "healthcare"
  | "accommodation"
  | "relocation"
  | "special_occasion"
  | "general"
  | "emergency";

export type CapabilityId =
  | "business_search"
  | "static_dataset"
  | "faq"
  | "knowledge_lookup"
  | "weather"
  | "events"
  | "booking";

export type ExecutionStepType =
  | "business_search"
  | "knowledge_lookup"
  | "faq"
  | "static_dataset"
  | "fast_path";

export type ResponseMode =
  | "clarify"
  | "fast_path"
  | "execute_and_explain"
  | "execute_no_explain"
  | "general_reply";

export type FieldKey =
  | "place_type"
  | "cuisine"
  | "stay_type"
  | "activity_hint"
  | "care_type"
  | "service_type"
  | "property_intent";

export interface GoalModel {
  /** Stable machine id, snake_case. */
  primary: string;
  /** Natural-language description for logs / grounding. */
  description: string;
}

export interface ConstraintFlags {
  outdoorSeating: boolean | null;
  seaView: boolean | null;
  familyFriendly: boolean | null;
  romantic: boolean | null;
  petFriendly: boolean | null;
  parking: boolean | null;
  wheelchairAccessible: boolean | null;
  kidsArea: boolean | null;
  breakfast: boolean | null;
  lunch: boolean | null;
  dinner: boolean | null;
  quiet: boolean | null;
  /** Prefer venues good when it rains (indoor / covered). Set by weather bias. */
  rainFriendly: boolean | null;
}

export interface ConstraintModel {
  required: ConstraintFlags;
  preferred: ConstraintFlags;
  avoid: ConstraintFlags;
  budget: "free" | "budget" | "mid" | "upscale" | "luxury" | null;
  distanceMeters: number | null;
  distanceLabel: string | null;
  openNow: boolean | null;
  emergency: boolean | null;
  partySize: number | null;
}

export interface EntityModel {
  locations: string[];
  estates: string[];
  landmarks: string[];
  businessTypes: string[];
  cuisines: string[];
  dates: string[];
  times: string[];
  people: string[];
}

export interface LocationRef {
  kind: "location" | "estate" | "landmark";
  label: string;
  lat: number | null;
  lng: number | null;
  source: "turn" | "sticky";
}

export interface ExecutionStep {
  id: string;
  capability: CapabilityId;
  type: ExecutionStepType;
  query: string;
  params: Record<string, unknown>;
  priority: number;
  optional: boolean;
}

/** Planner-owned celebration checklist item (dynamic per ask). */
export interface PlanFacet {
  id: string;
  label: string;
  searchQuery: string;
  verticalHint: string | null;
}

export interface PlannerDraft {
  intent: string;
  goal: GoalModel;
  confidence: number;
  candidateWorkflows: WorkflowId[];
  entities: EntityModel;
  constraints: ConstraintModel;
  draftQueries: string[];
  /** Dynamic celebration facets — empty for non-event asks. */
  planFacets: PlanFacet[];
  notes: string | null;
}

export interface PlannerPlan {
  version: "v2";
  intent: string;
  goal: GoalModel;
  workflow: WorkflowId;
  confidence: number;
  entities: EntityModel;
  constraints: ConstraintModel;
  missingInformation: string[];
  needsClarification: boolean;
  clarificationQuestion: string | null;
  executionPlan: ExecutionStep[];
  llmRequired: boolean;
  responseMode: ResponseMode;
  locationRef: LocationRef | null;
  /** How ranked results should be composed for explanation + UI. */
  composition: CompositionRequest;
  diagnostics: {
    extractorConfidence: number;
    rejectedWorkflows: WorkflowId[];
    rulesApplied: string[];
    stickyEntitiesUsed: boolean;
  };
}

export interface ConversationContext {
  city: City;
  history: ChatMessage[];
  stickyEntities: EntityModel;
  stickyConstraints: Partial<ConstraintModel>;
}

export interface WorkflowResponseBehaviour {
  allowExecuteWithoutRequired: boolean;
  emptyResultsMessage: string;
  preferFastPathCapability?: CapabilityId;
}

/** Pure config — no PromptName / LLM coupling. */
export interface WorkflowDefinition {
  id: WorkflowId;
  purpose: string;
  requiredFields: FieldKey[];
  optionalFields: FieldKey[];
  clarify: Partial<Record<FieldKey, string>>;
  defaultExecutionPlan: ExecutionStep[];
  rankConfig: Partial<RankConfig>;
  responseBehaviour: WorkflowResponseBehaviour;
  /** Fallback strategy when resolver rules do not pick a stronger one. */
  defaultCompositionStrategy?: PresentationStrategy;
}

export function emptyEntityModel(): EntityModel {
  return {
    locations: [],
    estates: [],
    landmarks: [],
    businessTypes: [],
    cuisines: [],
    dates: [],
    times: [],
    people: [],
  };
}

export function emptyConstraintFlags(): ConstraintFlags {
  return {
    outdoorSeating: null,
    seaView: null,
    familyFriendly: null,
    romantic: null,
    petFriendly: null,
    parking: null,
    wheelchairAccessible: null,
    kidsArea: null,
    breakfast: null,
    lunch: null,
    dinner: null,
    quiet: null,
    rainFriendly: null,
  };
}

export function emptyConstraintModel(): ConstraintModel {
  return {
    required: emptyConstraintFlags(),
    preferred: emptyConstraintFlags(),
    avoid: emptyConstraintFlags(),
    budget: null,
    distanceMeters: null,
    distanceLabel: null,
    openNow: null,
    emergency: null,
    partySize: null,
  };
}

export const FALLBACK_DRAFT: PlannerDraft = {
  intent: "general",
  goal: { primary: "continue_conversation", description: "Continue the conversation" },
  confidence: 0.2,
  candidateWorkflows: ["general"],
  entities: emptyEntityModel(),
  constraints: emptyConstraintModel(),
  draftQueries: [],
  planFacets: [],
  notes: null,
};
