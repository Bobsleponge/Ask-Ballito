import type { Metadata } from "next";
import Link from "next/link";
import { loadSearchQualityDashboard } from "@/lib/admin/eval-actions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata: Metadata = {
  title: "Search quality",
};

function formatPct(n: unknown): string {
  if (typeof n !== "number" || Number.isNaN(n)) return "n/a";
  return `${(n * 100).toFixed(1)}%`;
}

function formatUsd(n: unknown): string {
  if (typeof n !== "number" || Number.isNaN(n)) return "n/a";
  return `$${n.toFixed(4)}`;
}

function formatMs(n: unknown): string {
  if (typeof n !== "number" || Number.isNaN(n)) return "n/a";
  return `${Math.round(n)} ms`;
}

function nested(
  summary: Record<string, unknown>,
  path: string[],
): unknown {
  let cur: unknown = summary;
  for (const key of path) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export default async function AdminSearchQualityPage() {
  const dash = await loadSearchQualityDashboard();
  const summary = dash.latestRun?.summary ?? {};
  const prev = dash.previousRun?.summary ?? {};

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          <Link href="/admin" className="underline-offset-4 hover:underline">
            Admin
          </Link>{" "}
          / Search quality
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Search quality
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Evaluation platform health — Top-k accuracy, AI cost, latency, and
          coverage gaps. Run locally with{" "}
          <code className="text-xs">EVAL_LIVE=1 npm run eval:platform</code>.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">Gold dataset</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric
            label="Questions"
            value={dash.gold.totalQuestions.toLocaleString()}
          />
          <Metric
            label="Core (full tier)"
            value={dash.gold.coreQuestions.toLocaleString()}
          />
          <Metric
            label="Entity-labeled Top-1"
            value={dash.gold.entityLabeled.toLocaleString()}
            hint="Target 150–200 curated IDs"
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">Search health</h2>
        {!dash.latestRun ? (
          <p className="text-sm text-muted-foreground">
            No finished eval runs yet. Apply migration{" "}
            <code className="text-xs">0028_eval_platform.sql</code> and run the
            platform evaluator.
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Latest run{" "}
              <code className="text-xs">{dash.latestRun.id}</code>
              {dash.latestRun.gitSha
                ? ` · sha ${dash.latestRun.gitSha}`
                : null}
              {dash.latestRun.startedAt
                ? ` · ${dash.latestRun.startedAt}`
                : null}
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric
                label="Top-1 accuracy"
                value={formatPct(nested(summary, ["search", "top1Accuracy"]))}
                hint={
                  dash.previousRun
                    ? `prev ${formatPct(nested(prev, ["search", "top1Accuracy"]))}`
                    : undefined
                }
              />
              <Metric
                label="Top-3 accuracy"
                value={formatPct(nested(summary, ["search", "top3Accuracy"]))}
                hint={
                  dash.previousRun
                    ? `prev ${formatPct(nested(prev, ["search", "top3Accuracy"]))}`
                    : undefined
                }
              />
              <Metric
                label="Intent accuracy"
                value={formatPct(nested(summary, ["search", "intentAccuracy"]))}
              />
              <Metric
                label="Latency p50"
                value={formatMs(nested(summary, ["ai", "p50LatencyMs"]))}
                hint={`p95 ${formatMs(nested(summary, ["ai", "p95LatencyMs"]))}`}
              />
              <Metric
                label="LLM usage"
                value={formatPct(nested(summary, ["ai", "llmUsageRate"]))}
              />
              <Metric
                label="Cost / question"
                value={formatUsd(nested(summary, ["ai", "costPerQuestion"]))}
              />
              <Metric
                label="Cache hit"
                value={formatPct(nested(summary, ["ai", "cacheHitRate"]))}
              />
              <Metric
                label="Knowledge card hit"
                value={formatPct(
                  nested(summary, ["ai", "knowledgeCardHitRate"]),
                )}
              />
              <Metric
                label="SQL hit"
                value={formatPct(nested(summary, ["ai", "sqlHitRate"]))}
              />
              <Metric
                label="Vector hit"
                value={formatPct(nested(summary, ["ai", "vectorHitRate"]))}
              />
              <Metric
                label="Hybrid hit"
                value={formatPct(nested(summary, ["ai", "hybridHitRate"]))}
              />
              <Metric
                label="Questions in run"
                value={String(
                  nested(summary, ["questionCount"]) ??
                    dash.latestRun.questionCount,
                )}
              />
            </div>
          </>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">
          Knowledge coverage
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Metric
            label="Missing category"
            value={dash.coverage.businessesMissingCategory.toLocaleString()}
          />
          <Metric
            label="Missing description"
            value={dash.coverage.businessesMissingDescription.toLocaleString()}
          />
          <Metric
            label="Knowledge cards"
            value={dash.coverage.knowledgeCards.toLocaleString()}
          />
          <Metric
            label="Relations"
            value={dash.coverage.listingRelations.toLocaleString()}
          />
          <Metric
            label="Taxonomy terms"
            value={dash.coverage.taxonomyTerms.toLocaleString()}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">
          Poor / failed questions
        </h2>
        {dash.worstResults.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No failed rows stored for the latest run.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Question</TableHead>
                <TableHead>Intent</TableHead>
                <TableHead>Top-1</TableHead>
                <TableHead>Top-3</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dash.worstResults.map((row) => (
                <TableRow key={row.questionId}>
                  <TableCell>
                    <div className="space-y-0.5">
                      <p className="font-medium">{row.query}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.questionId}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {row.passIntent == null
                      ? "—"
                      : row.passIntent
                        ? "pass"
                        : "fail"}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {row.passTop1 == null
                      ? "—"
                      : row.passTop1
                        ? "pass"
                        : "fail"}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {row.passTop3 == null
                      ? "—"
                      : row.passTop3
                        ? "pass"
                        : "fail"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      {dash.localRunFiles.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-xl font-semibold tracking-tight">
            Local run artifacts
          </h2>
          <ul className="list-inside list-disc text-sm text-muted-foreground">
            {dash.localRunFiles.map((f) => (
              <li key={f}>
                <code className="text-xs">{f}</code>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
