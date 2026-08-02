/**
 * Shared gold dataset loading + intent family matching for evals.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { GoldQuestion, GoldIntent, GoldDataset, LabelingTier } from "./types";
import { isGoldQuestion } from "./types";

export type { GoldQuestion, GoldIntent, GoldDataset, LabelingTier };
export { isGoldQuestion };

/** Intent families treated as interchangeable for classifier precision. */
const SEARCH_FAMILY = new Set<string>([
  "BUSINESS_SEARCH",
  "DISCOVERY",
  "PLACE_SEARCH",
  "EVENT_SEARCH",
  "LIVE_INFORMATION",
  "NAVIGATION",
  "ACCOMMODATION",
  "EMERGENCY",
]);

const EMERGENCY_FAMILY = new Set<string>(["EMERGENCY", "BUSINESS_SEARCH", "LIVE_INFORMATION"]);
const ACCOMMODATION_FAMILY = new Set<string>(["ACCOMMODATION", "BUSINESS_SEARCH", "DISCOVERY"]);
const NAV_FAMILY = new Set<string>(["NAVIGATION", "PLACE_SEARCH", "BUSINESS_SEARCH"]);

export function loadGoldDataset(cwd = process.cwd()): GoldDataset {
  const raw = JSON.parse(
    readFileSync(join(cwd, "evals", "gold", "questions.json"), "utf8"),
  ) as GoldDataset;
  if (!Array.isArray(raw.questions)) {
    throw new Error("evals/gold/questions.json missing questions[]");
  }
  for (const q of raw.questions) {
    if (!isGoldQuestion(q)) {
      throw new Error(`Invalid gold question: ${JSON.stringify(q).slice(0, 120)}`);
    }
  }
  return raw;
}

export function intentMatches(
  detected: string | null | undefined,
  expected: GoldIntent | string,
): boolean {
  if (!detected) return false;
  if (detected === expected) return true;
  if (SEARCH_FAMILY.has(expected) && SEARCH_FAMILY.has(detected)) return true;
  if (expected === "EMERGENCY" && EMERGENCY_FAMILY.has(detected)) return true;
  if (expected === "ACCOMMODATION" && ACCOMMODATION_FAMILY.has(detected)) return true;
  if (expected === "NAVIGATION" && NAV_FAMILY.has(detected)) return true;
  if (expected === "FACT" && (detected === "FACT" || detected === "CONVERSATION")) {
    return true;
  }
  return false;
}

export function coreQuestions(dataset: GoldDataset): GoldQuestion[] {
  return dataset.questions.filter((q) => q.labelingTier === "full");
}

export type AppliedLabel = {
  questionId: string;
  expectTop1Ids: string[];
  expectTop3Ids: string[];
  notes?: string;
};

export function applyLabelsToDataset(
  dataset: GoldDataset,
  labels: AppliedLabel[],
): GoldDataset {
  const byId = new Map(labels.map((l) => [l.questionId, l]));
  return {
    ...dataset,
    questions: dataset.questions.map((q) => {
      const label = byId.get(q.id);
      if (!label) return q;
      return {
        ...q,
        labelingTier: "full" as const,
        expectTop1Ids: label.expectTop1Ids,
        expectTop3Ids: label.expectTop3Ids,
        notes: label.notes ?? q.notes,
      };
    }),
  };
}
