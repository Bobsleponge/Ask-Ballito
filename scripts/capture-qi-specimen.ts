/**
 * Capture QI understanding + draft constraints for a specimen query (OpenAI only).
 * Does not run Places ingest or full conversation ranking.
 *
 * Usage:
 *   npx tsx --env-file=.env.local --require ./scripts/shim-server-only.cjs scripts/capture-qi-specimen.ts
 *   QUERY="Outdoor activities for children around Ballito" npm run capture:qi-specimen
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { getCity } from "../src/config/cities";
import { queryIntelligenceService } from "../src/services/planner/query-intelligence.service";
import { buildConversationContext } from "../src/services/planner/context";
import { resolvePlannerPlan } from "../src/services/planner/resolver";
import { summarizeRequiredConstraints } from "../src/services/planner/eligibility";
import { emptyQueryTrace } from "../src/services/eval/query-trace";

async function main() {
  const query =
    process.env.QUERY?.trim() ||
    "Outdoor activities for children around Ballito";
  const city = getCity("ballito");
  if (!city) throw new Error("city ballito not found");

  const context = buildConversationContext({ city, history: [] });
  const { result, draft } = await queryIntelligenceService.understand({
    context,
    message: query,
  });
  const plan = resolvePlannerPlan(draft, context, query);

  const trace = emptyQueryTrace(query, city.slug);
  trace.understanding = {
    source: "query_intelligence",
    goalPrimary: draft.goal.primary,
    goalDescription: draft.goal.description,
    draftQueries: [...draft.draftQueries],
    planFacetCount: draft.planFacets.length,
    searchConcepts: [...(draft.searchConcepts ?? [])],
    hardExclusions: [...(draft.hardExclusions ?? [])],
    softPreferences: [...(result.softPreferences ?? [])],
    audience: result.audience,
    requiredConstraints: summarizeRequiredConstraints(plan.constraints),
    preferredConstraints: Object.fromEntries(
      Object.entries(plan.constraints.preferred).filter(([, v]) => v != null),
    ),
    environmentRequired: plan.constraints.environmentRequired,
    facets: draft.planFacets.map((f) => ({
      id: f.id,
      label: f.label,
      hard: f.hard === true,
      verticalHint: f.verticalHint,
    })),
    confidence: draft.confidence,
    notes: draft.notes,
  };
  trace.plan = {
    workflow: plan.workflow,
    executionQueries: plan.executionPlan.map((s) => s.query),
    llmRequired: plan.llmRequired,
    needsClarification: plan.needsClarification,
    rulesApplied: [...plan.diagnostics.rulesApplied],
    bucketProfile: plan.composition.bucketProfile ?? null,
    compositionStrategy: plan.composition.strategy,
  };

  const outDir = join(process.cwd(), "evals", "audit");
  mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = join(outDir, `qi-specimen-${stamp}.json`);
  const payload = {
    query,
    qi: result,
    draftConstraints: plan.constraints,
    composition: plan.composition,
    queryTrace: trace,
  };
  writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
  writeFileSync(
    join(outDir, "qi-specimen-latest.json"),
    JSON.stringify(payload, null, 2),
    "utf8",
  );

  console.log("Wrote", outPath);
  console.log(
    JSON.stringify(
      {
        audience: result.audience,
        explicitEnvironment: result.explicitEnvironment,
        explicitConstraints: result.explicitConstraints,
        searchConcepts: result.searchConcepts.slice(0, 8),
        required: summarizeRequiredConstraints(plan.constraints),
        workflow: plan.workflow,
        compositionStrategy: plan.composition.strategy,
        bucketProfile: plan.composition.bucketProfile ?? null,
        rules: plan.diagnostics.rulesApplied.filter((r) =>
          /composition|eligib|qi_|hard_/.test(r),
        ),
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
