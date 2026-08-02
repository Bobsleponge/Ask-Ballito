/**
 * Compare two evaluation runs (JSON files or DB run IDs).
 *
 * Usage:
 *   npm run eval:compare -- --prev=evals/runs/a.json --curr=evals/runs/b.json
 *   EVAL_LIVE=1 npm run eval:compare -- --prev=<uuid> --curr=<uuid>
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

type Summary = {
  search?: {
    top1Accuracy?: number | null;
    top3Accuracy?: number | null;
    intentAccuracy?: number | null;
    labeledCount?: number;
  };
  ai?: {
    llmUsageRate?: number;
    costPerQuestion?: number;
    avgLatencyMs?: number;
    p50LatencyMs?: number;
    p95LatencyMs?: number;
    cacheHitRate?: number;
    knowledgeCardHitRate?: number;
    sqlHitRate?: number;
    vectorHitRate?: number;
  };
  questionCount?: number;
  topSuggestionCodes?: Array<{ code: string; count: number }>;
};

type RunFile = { summary: Summary };

function loadSummary(ref: string): { label: string; summary: Summary } {
  if (ref.endsWith(".json")) {
    const text = readFileSync(ref, "utf8").replace(/^\uFEFF/, "");
    const raw = JSON.parse(text) as RunFile & Summary;
    const summary = (raw as RunFile).summary ?? (raw as Summary);
    return { label: ref, summary };
  }
  throw new Error(
    `DB run-id compare requires EVAL_LIVE harness; pass JSON paths for offline compare. Got: ${ref}`,
  );
}

async function loadSummaryMaybeDb(
  ref: string,
): Promise<{ label: string; summary: Summary }> {
  if (ref.endsWith(".json")) return loadSummary(ref);
  if (process.env.EVAL_LIVE === "1") {
    const { loadEvalRun } = await import("../src/services/eval/persist");
    const { run } = await loadEvalRun(ref);
    return {
      label: ref,
      summary: (run.summary ?? {}) as Summary,
    };
  }
  return loadSummary(ref);
}

function argValue(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.split("=")[1];
}

function delta(
  prev: number | null | undefined,
  curr: number | null | undefined,
): string {
  if (prev == null || curr == null) return "n/a";
  const d = curr - prev;
  const sign = d > 0 ? "+" : "";
  return `${sign}${(d * 100).toFixed(2)}pp`;
}

function deltaNum(
  prev: number | null | undefined,
  curr: number | null | undefined,
  suffix = "",
): string {
  if (prev == null || curr == null) return "n/a";
  const d = curr - prev;
  const sign = d > 0 ? "+" : "";
  return `${sign}${d.toFixed(4)}${suffix}`;
}

function fmtPct(n: number | null | undefined): string {
  if (n == null) return "n/a";
  return `${(n * 100).toFixed(1)}%`;
}

async function main() {
  const prevRef = argValue("prev");
  const currRef = argValue("curr");
  if (!prevRef || !currRef) {
    console.error(
      "Usage: npm run eval:compare -- --prev=<path|uuid> --curr=<path|uuid>",
    );
    process.exit(1);
  }

  const prev = await loadSummaryMaybeDb(prevRef);
  const curr = await loadSummaryMaybeDb(currRef);

  const lines: string[] = [];
  lines.push("# Eval comparison report");
  lines.push("");
  lines.push(`- Previous: \`${prev.label}\``);
  lines.push(`- Current: \`${curr.label}\``);
  lines.push("");
  lines.push("## Accuracy");
  lines.push("");
  lines.push("| Metric | Previous | Current | Delta |");
  lines.push("|---|---|---|---|");
  lines.push(
    `| Intent | ${fmtPct(prev.summary.search?.intentAccuracy)} | ${fmtPct(curr.summary.search?.intentAccuracy)} | ${delta(prev.summary.search?.intentAccuracy, curr.summary.search?.intentAccuracy)} |`,
  );
  lines.push(
    `| Top-1 | ${fmtPct(prev.summary.search?.top1Accuracy)} | ${fmtPct(curr.summary.search?.top1Accuracy)} | ${delta(prev.summary.search?.top1Accuracy, curr.summary.search?.top1Accuracy)} |`,
  );
  lines.push(
    `| Top-3 | ${fmtPct(prev.summary.search?.top3Accuracy)} | ${fmtPct(curr.summary.search?.top3Accuracy)} | ${delta(prev.summary.search?.top3Accuracy, curr.summary.search?.top3Accuracy)} |`,
  );
  lines.push("");
  lines.push("## Cost & AI");
  lines.push("");
  lines.push("| Metric | Previous | Current | Delta |");
  lines.push("|---|---|---|---|");
  lines.push(
    `| LLM usage | ${fmtPct(prev.summary.ai?.llmUsageRate)} | ${fmtPct(curr.summary.ai?.llmUsageRate)} | ${delta(prev.summary.ai?.llmUsageRate, curr.summary.ai?.llmUsageRate)} |`,
  );
  lines.push(
    `| Cost / question | $${(prev.summary.ai?.costPerQuestion ?? 0).toFixed(5)} | $${(curr.summary.ai?.costPerQuestion ?? 0).toFixed(5)} | ${deltaNum(prev.summary.ai?.costPerQuestion, curr.summary.ai?.costPerQuestion, "")} |`,
  );
  lines.push(
    `| Latency p50 | ${Math.round(prev.summary.ai?.p50LatencyMs ?? 0)}ms | ${Math.round(curr.summary.ai?.p50LatencyMs ?? 0)}ms | ${deltaNum(prev.summary.ai?.p50LatencyMs, curr.summary.ai?.p50LatencyMs, "ms")} |`,
  );
  lines.push(
    `| Cache hit | ${fmtPct(prev.summary.ai?.cacheHitRate)} | ${fmtPct(curr.summary.ai?.cacheHitRate)} | ${delta(prev.summary.ai?.cacheHitRate, curr.summary.ai?.cacheHitRate)} |`,
  );
  lines.push(
    `| Knowledge hit | ${fmtPct(prev.summary.ai?.knowledgeCardHitRate)} | ${fmtPct(curr.summary.ai?.knowledgeCardHitRate)} | ${delta(prev.summary.ai?.knowledgeCardHitRate, curr.summary.ai?.knowledgeCardHitRate)} |`,
  );
  lines.push("");
  lines.push("## Regressions / improvements");
  lines.push("");

  const regressions: string[] = [];
  const improvements: string[] = [];
  const check = (
    name: string,
    prevV: number | null | undefined,
    currV: number | null | undefined,
    higherIsBetter: boolean,
  ) => {
    if (prevV == null || currV == null) return;
    const better = higherIsBetter ? currV > prevV + 0.005 : currV < prevV - 0.005;
    const worse = higherIsBetter ? currV < prevV - 0.005 : currV > prevV + 0.005;
    if (better) improvements.push(`${name}: ${fmtPct(prevV)} → ${fmtPct(currV)}`);
    if (worse) regressions.push(`${name}: ${fmtPct(prevV)} → ${fmtPct(currV)}`);
  };

  check("Intent accuracy", prev.summary.search?.intentAccuracy, curr.summary.search?.intentAccuracy, true);
  check("Top-1 accuracy", prev.summary.search?.top1Accuracy, curr.summary.search?.top1Accuracy, true);
  check("Top-3 accuracy", prev.summary.search?.top3Accuracy, curr.summary.search?.top3Accuracy, true);
  check("LLM usage", prev.summary.ai?.llmUsageRate, curr.summary.ai?.llmUsageRate, false);
  check("Cache hit", prev.summary.ai?.cacheHitRate, curr.summary.ai?.cacheHitRate, true);

  if (improvements.length === 0) lines.push("- No material improvements detected.");
  else improvements.forEach((i) => lines.push(`- Improvement: ${i}`));
  if (regressions.length === 0) lines.push("- No material regressions detected.");
  else regressions.forEach((r) => lines.push(`- Regression: ${r}`));

  const md = lines.join("\n") + "\n";
  console.log(md);

  const outDir = join(process.cwd(), "evals", "runs");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, `compare-${Date.now()}.md`);
  writeFileSync(outPath, md);
  writeFileSync(
    outPath.replace(/\.md$/, ".json"),
    JSON.stringify({ prev, curr, improvements, regressions }, null, 2) + "\n",
  );
  console.log(`Wrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
