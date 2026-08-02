/**
 * Live Search Quality & AI evaluation platform runner.
 *
 * Usage:
 *   EVAL_LIVE=1 npm run eval:platform
 *   EVAL_LIVE=1 npm run eval:platform -- --limit=50
 *   EVAL_LIVE=1 npm run eval:platform -- --search-only
 *   EVAL_LIVE=1 npm run eval:platform -- --persist=0
 *
 * Requires local/staging Supabase credentials in .env.local.
 * Skips answer-cache read/write (ConversationParams.skipAnswerCache).
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { loadGoldDataset } from "../src/services/eval/gold";
import { evaluateQuestion } from "../src/services/eval/runner";
import {
  aggregateSearchMetrics,
} from "../src/services/eval/search-metrics";
import { aggregateAiMetrics } from "../src/services/eval/ai-metrics";
import { aggregateSuggestionCodes } from "../src/services/eval/suggestions";
import {
  createEvalRun,
  finalizeEvalRun,
  insertEvalResults,
} from "../src/services/eval/persist";
import { getRankConfigVersion } from "../src/services/ai/rank-config";

function argFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function argValue(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.split("=")[1];
}

function gitSha(): string | null {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

async function main() {
  if (process.env.EVAL_LIVE !== "1") {
    console.error(
      "Set EVAL_LIVE=1 to run the live evaluation platform against staging/local.",
    );
    console.error("Offline gates: npm run eval:routing && npm run eval:smoke");
    process.exit(1);
  }

  const limit = Number(argValue("limit") ?? "0") || undefined;
  const searchOnly = argFlag("search-only");
  const persist = argValue("persist") !== "0";
  const coreOnly = argFlag("core-only");

  const dataset = loadGoldDataset();
  let questions = dataset.questions;
  if (coreOnly) {
    questions = questions.filter((q) => q.labelingTier === "full");
  }
  if (limit) questions = questions.slice(0, limit);

  console.log(
    `Eval platform: ${questions.length} questions (searchOnly=${searchOnly}, persist=${persist})`,
  );

  const sha = gitSha();
  const rankVersion = getRankConfigVersion();
  let runId: string | null = null;

  if (persist) {
    try {
      runId = await createEvalRun({
        environment: process.env.EVAL_ENV ?? "local",
        gitSha: sha,
        rankConfigVersion: rankVersion,
        notes: searchOnly ? "search-only" : "full-orchestrator",
      });
      console.log(`Created eval_run ${runId}`);
    } catch (err) {
      console.warn(
        "Could not persist eval_run (migrate 0028?). Continuing without DB.",
        err instanceof Error ? err.message : err,
      );
    }
  }

  const outcomes = [];
  let i = 0;
  for (const q of questions) {
    i += 1;
    process.stdout.write(`[${i}/${questions.length}] ${q.id}… `);
    try {
      const outcome = await evaluateQuestion(q, {
        skipOrchestrator: searchOnly,
      });
      outcomes.push(outcome);
      const top =
        outcome.passTop1 === null
          ? "n/a"
          : outcome.passTop1
            ? "T1✓"
            : "T1✗";
      console.log(
        `${outcome.passIntent ? "intent✓" : "intent✗"} ${top} ${Math.round(outcome.ai.latencyMs)}ms`,
      );
    } catch (err) {
      console.log("FAIL");
      console.error(err instanceof Error ? err.message : err);
      outcomes.push({
        questionId: q.id,
        query: q.query,
        intentExpected: q.intent,
        intentDetected: null,
        passIntent: false,
        passTop1: null,
        passTop3: null,
        passTop5: null,
        search: {
          top1Hit: null,
          top3Hit: null,
          top5Hit: null,
          wrongEntityType: null,
          rankingError: null,
          missedBusinesses: [],
          falsePositives: 0,
          duplicateResults: 0,
          missingMetadata: 0,
          entityCoverage: 0,
        },
        ai: {
          llmUsed: false,
          cacheHit: false,
          knowledgeHit: false,
          sqlHit: false,
          vectorHit: false,
          hybridHit: false,
          promptTokens: 0,
          completionTokens: 0,
          estimatedCostUsd: 0,
          latencyMs: 0,
          searchLatencyMs: null,
          rankLatencyMs: null,
          aiLatencyMs: null,
          model: null,
          primaryRoute: "hybrid",
        },
        suggestions: [
          {
            code: "runner_error",
            severity: "high" as const,
            message: err instanceof Error ? err.message : String(err),
            questionId: q.id,
          },
        ],
        metrics: { error: true },
        finalResponse: "",
        resultIds: [],
      });
    }
  }

  const searchAgg = aggregateSearchMetrics(
    outcomes.map((o) => ({ search: o.search, passIntent: o.passIntent })),
  );
  const aiAgg = aggregateAiMetrics(outcomes.map((o) => o.ai));
  const suggestionAgg = aggregateSuggestionCodes(
    outcomes.flatMap((o) => o.suggestions),
  );

  const summary = {
    gitSha: sha,
    rankConfigVersion: rankVersion,
    questionCount: outcomes.length,
    search: searchAgg,
    ai: aiAgg,
    topSuggestionCodes: suggestionAgg.slice(0, 15),
    worstQuestions: outcomes
      .filter(
        (o) =>
          o.passIntent === false ||
          o.passTop1 === false ||
          o.passTop3 === false,
      )
      .slice(0, 25)
      .map((o) => ({
        id: o.questionId,
        query: o.query,
        passIntent: o.passIntent,
        passTop1: o.passTop1,
        passTop3: o.passTop3,
        suggestions: o.suggestions.map((s) => s.code),
      })),
  };

  const outDir = join(process.cwd(), "evals", "runs");
  mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = join(outDir, `${stamp}${runId ? `-${runId.slice(0, 8)}` : ""}.json`);
  writeFileSync(
    outPath,
    JSON.stringify({ summary, outcomes }, null, 2) + "\n",
  );

  if (runId) {
    try {
      await insertEvalResults(
        runId,
        outcomes.map((o) => ({
          questionId: o.questionId,
          query: o.query,
          intentExpected: o.intentExpected,
          intentDetected: o.intentDetected,
          passIntent: o.passIntent,
          passTop1: o.passTop1,
          passTop3: o.passTop3,
          passTop5: o.passTop5,
          metrics: o.metrics,
          suggestions: o.suggestions,
        })),
      );
      await finalizeEvalRun({
        runId,
        questionCount: outcomes.length,
        summary,
      });
      console.log(`Persisted run ${runId}`);
    } catch (err) {
      console.warn(
        "Persist failed:",
        err instanceof Error ? err.message : err,
      );
    }
  }

  console.log("\n=== Baseline summary ===");
  console.log(
    `Intent accuracy: ${fmtPct(searchAgg.intentAccuracy)} (${outcomes.filter((o) => o.passIntent).length}/${outcomes.length})`,
  );
  console.log(
    `Top-1 accuracy:  ${fmtPct(searchAgg.top1Accuracy)} (labeled=${searchAgg.labeledCount})`,
  );
  console.log(`Top-3 accuracy:  ${fmtPct(searchAgg.top3Accuracy)}`);
  console.log(`LLM usage:       ${fmtPct(aiAgg.llmUsageRate)}`);
  console.log(`Cost / question: $${aiAgg.costPerQuestion.toFixed(5)}`);
  console.log(
    `Latency p50/p95: ${Math.round(aiAgg.p50LatencyMs)} / ${Math.round(aiAgg.p95LatencyMs)} ms`,
  );
  console.log(`Cache hit:       ${fmtPct(aiAgg.cacheHitRate)}`);
  console.log(`Knowledge hit:   ${fmtPct(aiAgg.knowledgeCardHitRate)}`);
  console.log(`Wrote ${outPath}`);
}

function fmtPct(n: number | null): string {
  if (n == null) return "n/a";
  return `${(n * 100).toFixed(1)}%`;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
