import type { PlannerResult } from "@/lib/ai/prompts/planner.v1";

/** Build a short clarification from planner missingInformation or fallbacks. */
export function buildClarificationMessage(
  plan: PlannerResult,
  fallbacks: string[],
): string {
  const missing =
    plan.missingInformation.length > 0
      ? plan.missingInformation
      : fallbacks;

  if (missing.length === 1) {
    const item = missing[0];
    const looksLikeQuestion = /\?$/.test(item) || /^(what|which|are|do|is)\b/i.test(item);
    return looksLikeQuestion
      ? item
      : `Happy to help — could you tell me the ${item}?`;
  }

  const bullets = missing
    .slice(0, 3)
    .map((m) => `• ${m}`)
    .join("\n");
  return `I can help with that — just need a bit more detail:\n${bullets}`;
}

export function defaultSearchQueries(
  plan: PlannerResult,
  defaults: string[],
): string[] {
  if (plan.searchQueries.length > 0) return plan.searchQueries;
  return defaults;
}
