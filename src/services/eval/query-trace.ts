/**
 * End-to-end query intelligence trace for forensic audit (QUERY_TRACE=1).
 */

import type { QueryClass } from "@/services/routing/types";
import type { FailureLayer } from "./failure-taxonomy";

export type QueryTraceUnderstandingSource =
  | "classifier_short_circuit"
  | "planner_extractor"
  | "query_intelligence"
  | "qi_shadow"
  | "cache"
  | "knowledge";

export type QueryTrace = {
  query: string;
  city: string;
  classification: {
    queryClass: QueryClass | null;
    confidence: number | null;
    signals: string[];
    canSkipExtractor: boolean;
    didShortCircuit: boolean;
  };
  understanding: {
    source: QueryTraceUnderstandingSource;
    goalPrimary: string | null;
    goalDescription: string | null;
    draftQueries: string[];
    planFacetCount: number;
    searchConcepts: string[];
    hardExclusions: string[];
    softPreferences: string[];
    audience: string | null;
    /** Compact required dims (flags + environment + audience). */
    requiredConstraints: Record<string, boolean | string | null>;
    preferredConstraints: Record<string, boolean | string | null>;
    environmentRequired: string | null;
    facets: Array<{
      id: string;
      label: string;
      hard: boolean;
      verticalHint: string | null;
    }>;
    confidence: number | null;
    notes: string | null;
  };
  plan: {
    workflow: string | null;
    executionQueries: string[];
    llmRequired: boolean;
    needsClarification: boolean;
    rulesApplied: string[];
    bucketProfile: string | null;
    compositionStrategy: string | null;
  };
  retrieval: {
    candidateCount: number;
    retrievalMode: string | null;
  };
  eligibility: {
    hadHardRequirements: boolean;
    inputCount: number;
    eligibleCount: number;
    droppedCount: number;
    dropReasons: Record<string, number>;
    /** Sample of dropped names (capped). */
    droppedSample: Array<{ name: string; reasons: string[] }>;
  };
  composition: {
    strategy: string | null;
    sectionCount: number;
    businessCount: number;
    sectionTitles: string[];
  };
  fitVerify: {
    ran: boolean;
    reason: string | null;
  };
  narration: {
    llmNarrate: boolean;
    deterministic: boolean;
  };
  /** Populated by audit labeling, not the live orchestrator. */
  failure?: {
    primary: FailureLayer;
    secondaries: FailureLayer[];
    rationale: string;
    shortCircuitLikelyCause: boolean;
    extractorWouldHelp: boolean;
  };
};

export function emptyQueryTrace(query: string, city: string): QueryTrace {
  return {
    query,
    city,
    classification: {
      queryClass: null,
      confidence: null,
      signals: [],
      canSkipExtractor: false,
      didShortCircuit: false,
    },
    understanding: {
      source: "classifier_short_circuit",
      goalPrimary: null,
      goalDescription: null,
      draftQueries: [],
      planFacetCount: 0,
      searchConcepts: [],
      hardExclusions: [],
      softPreferences: [],
      audience: null,
      requiredConstraints: {},
      preferredConstraints: {},
      environmentRequired: null,
      facets: [],
      confidence: null,
      notes: null,
    },
    plan: {
      workflow: null,
      executionQueries: [],
      llmRequired: false,
      needsClarification: false,
      rulesApplied: [],
      bucketProfile: null,
      compositionStrategy: null,
    },
    retrieval: {
      candidateCount: 0,
      retrievalMode: null,
    },
    eligibility: {
      hadHardRequirements: false,
      inputCount: 0,
      eligibleCount: 0,
      droppedCount: 0,
      dropReasons: {},
      droppedSample: [],
    },
    composition: {
      strategy: null,
      sectionCount: 0,
      businessCount: 0,
      sectionTitles: [],
    },
    fitVerify: {
      ran: false,
      reason: null,
    },
    narration: {
      llmNarrate: false,
      deterministic: true,
    },
  };
}
