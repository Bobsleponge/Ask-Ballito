/**
 * Phase 0 forensic audit: short-circuit vs understanding richness.
 *
 * Offline (default): classify + draftFromClassification + heuristic failure labels.
 * Optional live extractor compare: EVAL_LIVE=1 (OpenAI spend).
 *
 * Usage:
 *   npm run eval:qi-audit
 *   EVAL_LIVE=1 npm run eval:qi-audit
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { classifyQuery } from "../src/services/classifier/classify";
import { draftFromClassification } from "../src/services/classifier";
import {
  shouldShortCircuitExtractor,
  isDeterministicClassifierOnly,
} from "../src/config/short-circuit-policy";
import {
  countConstraintSignals,
  labelFailureHeuristic,
  type FailureLayer,
} from "../src/services/eval/failure-taxonomy";
import { CITIES } from "../src/config/cities";
import {
  buildConversationContext,
  type PlannerDraft,
} from "../src/services/planner";

type CorpusQuestion = {
  id: string;
  query: string;
  city: string;
  source: string;
  suggestions?: string[];
  passIntent?: boolean | null;
  passTop1?: boolean | null;
  passTop3?: boolean | null;
};

type Corpus = { version: number; questions: CorpusQuestion[] };

const live = process.env.EVAL_LIVE === "1";
const corpusPath = join(
  process.cwd(),
  "evals",
  "audit",
  "query-intelligence-corpus.json",
);
const corpus = JSON.parse(readFileSync(corpusPath, "utf8")) as Corpus;

function draftRichness(draft: PlannerDraft) {
  return {
    draftQueryCount: draft.draftQueries.length,
    planFacetCount: draft.planFacets.length,
    constraintSignalCount: countConstraintSignals(draft.constraints),
  };
}

async function maybeExtract(query: string, citySlug: string) {
  if (!live) return null;
  const { plannerExtractorService } = await import(
    "../src/services/planner/extractor.service"
  );
  const city = CITIES.find((c) => c.slug === citySlug) ?? CITIES[0]!;
  const context = buildConversationContext({
    city,
    history: [],
    stickySummary: null,
  });
  try {
    const draft = await plannerExtractorService.extract({
      context,
      message: query,
    });
    return draftRichness(draft);
  } catch {
    return null;
  }
}

async function main() {
  const layerCounts = new Map<FailureLayer, number>();
  let shortCircuitWouldRun = 0;
  let shortCircuitHarm = 0;
  let extractorWouldHelp = 0;
  let thinDrafts = 0;
  const traces: unknown[] = [];

  for (const q of corpus.questions) {
    const classification = classifyQuery({
      message: q.query,
      citySlug: q.city,
    });
    const legacySkip =
      classification.canSkipExtractor && classification.confidence >= 0.85;
    const qiPolicySkip = isDeterministicClassifierOnly(classification);
    const wouldShortCircuit = shouldShortCircuitExtractor(classification);

    // Force legacy short-circuit draft for structural comparison regardless of QI flag.
    const scDraft = draftFromClassification(classification, q.query);
    const scRich = draftRichness(scDraft);
    if (scRich.planFacetCount === 0 && scRich.draftQueryCount <= 1) {
      thinDrafts += 1;
    }
    if (legacySkip) shortCircuitWouldRun += 1;

    const extractorRich = await maybeExtract(q.query, q.city);

    const label = labelFailureHeuristic({
      query: q.query,
      suggestions: q.suggestions ?? [],
      passIntent: q.passIntent ?? null,
      passTop1: q.passTop1 ?? null,
      passTop3: q.passTop3 ?? null,
      shortCircuitDraft: scRich,
      extractorDraft: extractorRich,
    });

    layerCounts.set(label.primary, (layerCounts.get(label.primary) ?? 0) + 1);
    if (label.shortCircuitLikelyCause) shortCircuitHarm += 1;
    if (label.extractorWouldHelp) extractorWouldHelp += 1;

    traces.push({
      id: q.id,
      query: q.query,
      source: q.source,
      classification: {
        queryClass: classification.queryClass,
        confidence: classification.confidence,
        signals: classification.signals,
        legacyWouldShortCircuit: legacySkip,
        qiPolicyWouldShortCircuit: qiPolicySkip,
        currentFlagWouldShortCircuit: wouldShortCircuit,
      },
      shortCircuitDraft: scRich,
      extractorDraft: extractorRich,
      failure: label,
    });
  }

  const n = corpus.questions.length;
  const pct = (c: number) => Math.round((c / n) * 1000) / 10;
  const layerPct: Record<string, { count: number; pct: number }> = {};
  for (const [layer, count] of layerCounts) {
    layerPct[layer] = { count, pct: pct(count) };
  }

  const summary = {
    questionCount: n,
    liveExtractorCompare: live,
    legacyShortCircuitEligiblePct: pct(shortCircuitWouldRun),
    thinShortCircuitDraftPct: pct(thinDrafts),
    shortCircuitLikelyRootCausePct: pct(shortCircuitHarm),
    extractorWouldHelpPct: pct(extractorWouldHelp),
    primaryLayerPct: layerPct,
    generatedAt: new Date().toISOString(),
  };

  const outDir = join(process.cwd(), "evals", "audit");
  mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = join(outDir, `qi-audit-${stamp}.json`);
  writeFileSync(outPath, JSON.stringify({ summary, traces }, null, 2));
  writeFileSync(
    join(outDir, "qi-audit-latest.json"),
    JSON.stringify({ summary, traces }, null, 2),
  );

  console.log("Query Intelligence forensic audit\n");
  console.log(JSON.stringify(summary, null, 2));
  console.log(`\nWrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
