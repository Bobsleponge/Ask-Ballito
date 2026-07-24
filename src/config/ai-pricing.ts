/**
 * OpenAI list-price estimates (USD per 1M tokens). Update when pricing changes.
 * Used for admin cost dashboards — not billing.
 */

export type AiPricingRow = {
  inputPerMillion: number;
  outputPerMillion: number;
};

/** Version stamp for audit when prices change. */
export const AI_PRICING_VERSION = "2026-07-21";

const PRICING: Record<string, AiPricingRow> = {
  "gpt-4.1-mini": { inputPerMillion: 0.4, outputPerMillion: 1.6 },
  "gpt-4.1": { inputPerMillion: 2.0, outputPerMillion: 8.0 },
  "text-embedding-3-small": { inputPerMillion: 0.02, outputPerMillion: 0 },
  "text-embedding-3-large": { inputPerMillion: 0.13, outputPerMillion: 0 },
};

const DEFAULT_CHAT: AiPricingRow = { inputPerMillion: 0.4, outputPerMillion: 1.6 };

export function getModelPricing(model: string | null | undefined): AiPricingRow {
  if (!model) return DEFAULT_CHAT;
  return PRICING[model] ?? DEFAULT_CHAT;
}

export function estimateCostUsd(params: {
  model?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
}): number | null {
  const input = params.inputTokens ?? 0;
  const output = params.outputTokens ?? 0;
  if (input <= 0 && output <= 0) return null;
  const p = getModelPricing(params.model);
  const usd =
    (input / 1_000_000) * p.inputPerMillion +
    (output / 1_000_000) * p.outputPerMillion;
  return Math.round(usd * 1_000_000) / 1_000_000;
}
