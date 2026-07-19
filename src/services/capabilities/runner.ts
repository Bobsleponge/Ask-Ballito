import "server-only";
import type { City } from "@/config/cities";
import type { ExecutionStep, PlannerPlan } from "@/services/planner/types";
import type { BusinessResult } from "@/lib/schemas/business";
import { getCapability } from "./registry";
import type { CapabilityResult } from "./types";

export interface ExecutionRunResult {
  results: CapabilityResult[];
  businesses: BusinessResult[];
  fastPathText: string | null;
  unknownCapabilities: string[];
}

/**
 * Runs an ordered execution plan via the capability registry.
 * business_search steps run in parallel batches by priority.
 */
export async function runExecutionPlan(opts: {
  plan: PlannerPlan;
  city: City;
  message: string;
}): Promise<ExecutionRunResult> {
  const steps = [...opts.plan.executionPlan].sort(
    (a, b) => a.priority - b.priority,
  );
  const results: CapabilityResult[] = [];
  const unknownCapabilities: string[] = [];
  let fastPathText: string | null = null;

  const byPriority = new Map<number, ExecutionStep[]>();
  for (const step of steps) {
    const list = byPriority.get(step.priority) ?? [];
    list.push(step);
    byPriority.set(step.priority, list);
  }

  const priorities = [...byPriority.keys()].sort((a, b) => a - b);

  for (const p of priorities) {
    const batch = byPriority.get(p)!;
    const batchResults = await Promise.all(
      batch.map(async (step) => {
        const cap = getCapability(step.capability);
        if (!cap) {
          unknownCapabilities.push(step.capability);
          return null;
        }
        return cap.execute({
          step,
          city: opts.city,
          plan: opts.plan,
          message: opts.message,
        });
      }),
    );

    for (const r of batchResults) {
      if (!r) continue;
      results.push(r);
      if (r.text && !fastPathText) fastPathText = r.text;
    }
  }

  const byId = new Map<string, BusinessResult>();
  for (const r of results) {
    for (const b of r.businesses) {
      const existing = byId.get(b.id);
      if (!existing || (b.similarity ?? 0) > (existing.similarity ?? 0)) {
        byId.set(b.id, b);
      }
    }
  }

  return {
    results,
    businesses: [...byId.values()],
    fastPathText,
    unknownCapabilities,
  };
}
