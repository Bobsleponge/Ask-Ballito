/**
 * Search quality metrics for a single gold question vs observed results.
 */
import type { GoldQuestion } from "./types";

export type ObservedSearch = {
  resultIds: string[];
  resultCategories: Array<string | null>;
  resultVerticals?: Array<string | null>;
  duplicates: number;
  missingMetadataCount: number;
  retrievalMode?: string | null;
};

export type SearchMetricResult = {
  top1Hit: boolean | null;
  top3Hit: boolean | null;
  top5Hit: boolean | null;
  wrongEntityType: boolean | null;
  rankingError: boolean | null;
  missedBusinesses: string[];
  falsePositives: number;
  duplicateResults: number;
  missingMetadata: number;
  entityCoverage: number;
};

function hasEntityGold(q: GoldQuestion): boolean {
  return (
    q.labelingTier === "full" &&
    Array.isArray(q.expectTop1Ids) &&
    q.expectTop1Ids.length > 0
  );
}

export function computeSearchMetrics(
  gold: GoldQuestion,
  observed: ObservedSearch,
): SearchMetricResult {
  const ids = observed.resultIds;
  const top1 = ids[0];
  const top3 = ids.slice(0, 3);
  const top5 = ids.slice(0, 5);

  let top1Hit: boolean | null = null;
  let top3Hit: boolean | null = null;
  let top5Hit: boolean | null = null;
  let rankingError: boolean | null = null;
  let missedBusinesses: string[] = [];
  let falsePositives = 0;

  if (hasEntityGold(gold)) {
    const expect1 = new Set(gold.expectTop1Ids ?? []);
    const expect3 = new Set(gold.expectTop3Ids ?? gold.expectTop1Ids ?? []);
    top1Hit = top1 != null && expect1.has(top1);
    top3Hit = top3.some((id) => expect3.has(id));
    top5Hit = top5.some((id) => expect3.has(id));

    missedBusinesses = [...expect3].filter((id) => !ids.includes(id));
    rankingError =
      missedBusinesses.length === 0 &&
      [...expect3].some((id) => {
        const rank = ids.indexOf(id);
        return rank >= 3;
      });

    const allow = expect3;
    falsePositives = top5.filter((id) => !allow.has(id)).length;
  }

  let wrongEntityType: boolean | null = null;
  if (gold.expectEntityType && observed.resultCategories.length > 0) {
    const needle = gold.expectEntityType.toLowerCase();
    const verticalNeedle = (gold.expectVertical ?? "").toLowerCase();
    const anyMatch = observed.resultCategories.some((c) => {
      const cat = (c ?? "").toLowerCase();
      return (
        cat.includes(needle) ||
        (verticalNeedle && cat.includes(verticalNeedle))
      );
    });
    const verticalMatch =
      observed.resultVerticals?.some((v) => {
        const vv = (v ?? "").toLowerCase();
        return (
          vv === needle ||
          vv === verticalNeedle ||
          vv.includes(needle) ||
          (verticalNeedle && vv.includes(verticalNeedle))
        );
      }) ?? false;
    wrongEntityType = !(anyMatch || verticalMatch);
  }

  const entityCoverage =
    gold.expectTop3Ids && gold.expectTop3Ids.length > 0
      ? gold.expectTop3Ids.filter((id) => ids.includes(id)).length /
        gold.expectTop3Ids.length
      : ids.length > 0
        ? 1
        : 0;

  return {
    top1Hit,
    top3Hit,
    top5Hit,
    wrongEntityType,
    rankingError,
    missedBusinesses,
    falsePositives,
    duplicateResults: observed.duplicates,
    missingMetadata: observed.missingMetadataCount,
    entityCoverage,
  };
}

export type AggregateSearchMetrics = {
  labeledCount: number;
  top1Accuracy: number | null;
  top3Accuracy: number | null;
  top5Accuracy: number | null;
  wrongEntityTypeRate: number | null;
  rankingErrorRate: number | null;
  avgEntityCoverage: number;
  intentAccuracy: number | null;
};

export function aggregateSearchMetrics(
  rows: Array<{
    search: SearchMetricResult;
    passIntent: boolean | null;
  }>,
): AggregateSearchMetrics {
  const labeled = rows.filter((r) => r.search.top1Hit !== null);
  const entityTypeRows = rows.filter((r) => r.search.wrongEntityType !== null);
  const intentRows = rows.filter((r) => r.passIntent !== null);

  const rate = (hits: number, total: number) =>
    total > 0 ? hits / total : null;

  return {
    labeledCount: labeled.length,
    top1Accuracy: rate(
      labeled.filter((r) => r.search.top1Hit).length,
      labeled.length,
    ),
    top3Accuracy: rate(
      labeled.filter((r) => r.search.top3Hit).length,
      labeled.length,
    ),
    top5Accuracy: rate(
      labeled.filter((r) => r.search.top5Hit).length,
      labeled.length,
    ),
    wrongEntityTypeRate: rate(
      entityTypeRows.filter((r) => r.search.wrongEntityType).length,
      entityTypeRows.length,
    ),
    rankingErrorRate: rate(
      labeled.filter((r) => r.search.rankingError).length,
      labeled.length,
    ),
    avgEntityCoverage:
      rows.length > 0
        ? rows.reduce((s, r) => s + r.search.entityCoverage, 0) / rows.length
        : 0,
    intentAccuracy: rate(
      intentRows.filter((r) => r.passIntent).length,
      intentRows.length,
    ),
  };
}
