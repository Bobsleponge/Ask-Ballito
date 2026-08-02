import rankWeightsJson from "@/config/rank-weights.json";
import type { RankConfig } from "@/services/ai/ranking.engine";
import { DEFAULT_RANK_CONFIG } from "@/services/ai/ranking.engine";

export interface RankWeightsFile {
  version: string;
  description?: string;
  weights: {
    similarity: number;
    exactKeyword: number;
    rating: number;
    popularity: number;
    reviewVolume: number;
    typeBoost: number;
    attributeBoost: number;
    keywordBoost: number;
    quality: number;
    distance: number;
    price: number;
    verified: number;
    openNow: number;
    freshness: number;
  };
  limits: {
    limit: number;
    minScore: number;
    relativeFloor: number;
    minKeep: number;
    preferVariety: boolean;
  };
}

const file = rankWeightsJson as RankWeightsFile;

/**
 * Load ranking weights from JSON config (changeable without code edits).
 */
export function loadRankConfig(
  overrides?: Partial<RankConfig>,
): RankConfig {
  return {
    ...DEFAULT_RANK_CONFIG,
    similarity: file.weights.similarity,
    rating: file.weights.rating,
    popularity: file.weights.popularity + file.weights.reviewVolume,
    typeBoost: file.weights.typeBoost,
    attributeBoost: file.weights.attributeBoost,
    keywordBoost: file.weights.keywordBoost + file.weights.exactKeyword,
    quality: file.weights.quality,
    distance: file.weights.distance,
    price: file.weights.price,
    verified: file.weights.verified,
    openNow: file.weights.openNow,
    freshness: file.weights.freshness,
    limit: file.limits.limit,
    minScore: file.limits.minScore,
    relativeFloor: file.limits.relativeFloor,
    minKeep: file.limits.minKeep,
    preferVariety: file.limits.preferVariety,
    ...overrides,
  };
}

export function getRankConfigVersion(): string {
  return file.version;
}

export function getRankWeightsFile(): RankWeightsFile {
  return file;
}
