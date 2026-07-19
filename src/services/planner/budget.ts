import type { ConstraintModel } from "./types";

const BUDGET_MAP: Record<string, ConstraintModel["budget"]> = {
  free: "free",
  cheap: "budget",
  affordable: "budget",
  budget: "budget",
  "mid-range": "mid",
  midrange: "mid",
  mid: "mid",
  moderate: "mid",
  upscale: "upscale",
  nice: "upscale",
  fancy: "upscale",
  luxury: "luxury",
  expensive: "luxury",
  splurge: "luxury",
};

export function parseBudgetLabel(
  raw: string | null | undefined,
): ConstraintModel["budget"] {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  return BUDGET_MAP[key] ?? null;
}

/** Map budget band to preferred Google-style price level 0–4. */
export function budgetToPriceLevel(
  budget: ConstraintModel["budget"],
): number | null {
  switch (budget) {
    case "free":
      return 0;
    case "budget":
      return 1;
    case "mid":
      return 2;
    case "upscale":
      return 3;
    case "luxury":
      return 4;
    default:
      return null;
  }
}
