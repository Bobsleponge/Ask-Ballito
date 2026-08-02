import type { Metadata } from "next";
import Link from "next/link";
import { loadTopAiUsage } from "@/lib/admin/ai-usage-actions";
import { loadRoutingMetrics } from "@/lib/admin/routing-metrics";
import { getRankWeightsFile } from "@/services/ai/rank-config";
import { AbuseSuspendButton } from "@/components/admin/abuse-suspend-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata: Metadata = {
  title: "AI usage",
};

function formatUsd(n: number): string {
  return `$${n.toFixed(4)}`;
}

function formatPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export default async function AdminAiUsagePage() {
  const [{ rows, totalEstimatedCostUsd, totalCalls }, routing, rankWeights] =
    await Promise.all([
      loadTopAiUsage(25),
      loadRoutingMetrics(),
      Promise.resolve(getRankWeightsFile()),
    ]);

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          <Link href="/admin" className="underline-offset-4 hover:underline">
            Admin
          </Link>{" "}
          / AI usage
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">AI usage</h1>
        <p className="max-w-2xl text-muted-foreground">
          Estimated OpenAI spend from token logs (last 7 days). Not an invoice —
          prices are configured in{" "}
          <code className="text-xs">src/config/ai-pricing.ts</code>.
        </p>
        <p className="text-sm text-muted-foreground">
          Totals:{" "}
          <span className="font-medium text-foreground tabular-nums">
            {formatUsd(totalEstimatedCostUsd)}
          </span>{" "}
          · {totalCalls.toLocaleString()} calls
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">
          Intelligence routing (7d)
        </h2>
        <p className="text-sm text-muted-foreground">
          From ConversationOrchestrator telemetry. Targets: ≥70% no-LLM, median
          deterministic under 800ms.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Turns" value={routing.totalTurns.toLocaleString()} />
          <Metric
            label="Cache hit rate"
            value={formatPct(routing.cacheHitRate)}
          />
          <Metric
            label="Knowledge resolve %"
            value={formatPct(routing.knowledgeResolutionRate)}
          />
          <Metric
            label="Search resolve %"
            value={formatPct(routing.searchResolutionRate)}
          />
          <Metric
            label="FACT/SQL resolve %"
            value={formatPct(routing.factResolutionRate)}
          />
          <Metric label="LLM usage %" value={formatPct(routing.llmUsageRate)} />
          <Metric
            label="Avg latency"
            value={`${Math.round(routing.avgLatencyMs)} ms`}
          />
          <Metric
            label="Avg resolver"
            value={`${Math.round(routing.avgKnowledgeResolverMs)} ms`}
          />
          <Metric label="Extract rate" value={formatPct(routing.extractRate)} />
          <Metric label="Narrate rate" value={formatPct(routing.narrateRate)} />
          <Metric
            label="Hybrid/SQL rate"
            value={formatPct(routing.sqlOrHybridRate)}
          />
          <Metric
            label="Cost / request"
            value={formatUsd(routing.costPerRequest)}
          />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Distribution
            title="Route distribution"
            data={routing.routeDistribution}
          />
          <Distribution
            title="Query class distribution"
            data={routing.queryClassDistribution}
          />
        </div>

        <p className="text-xs text-muted-foreground">
          Active rank config: <code>{rankWeights.version}</code> — similarity{" "}
          {rankWeights.weights.similarity}, keyword{" "}
          {rankWeights.weights.keywordBoost}
        </p>
      </section>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No signed-in AI activity in the last 7 days.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead className="text-right">Est. $</TableHead>
              <TableHead className="text-right">Calls</TableHead>
              <TableHead className="text-right">Tokens</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.userId}>
                <TableCell>
                  <div className="font-medium">
                    {row.email ?? "Unknown email"}
                  </div>
                  <div className="font-mono text-xs text-muted-foreground">
                    {row.userId}
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatUsd(row.estimatedCostUsd)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.calls}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {(row.inputTokens + row.outputTokens).toLocaleString()}
                </TableCell>
                <TableCell>
                  {row.abuseSuspended ? (
                    <span className="text-destructive">Suspended</span>
                  ) : (
                    <span className="text-muted-foreground">Active</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <AbuseSuspendButton
                    userId={row.userId}
                    suspended={row.abuseSuspended}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function Metric(props: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 px-4 py-3">
      <p className="text-xs text-muted-foreground">{props.label}</p>
      <p className="text-lg font-semibold tabular-nums tracking-tight">
        {props.value}
      </p>
    </div>
  );
}

function Distribution(props: {
  title: string;
  data: Record<string, number>;
}) {
  const entries = Object.entries(props.data).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, n]) => s + n, 0) || 1;
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">{props.title}</h3>
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">No routing data yet.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {entries.map(([key, n]) => (
            <li key={key} className="flex justify-between gap-4">
              <span className="font-mono text-xs">{key}</span>
              <span className="tabular-nums text-muted-foreground">
                {n} ({((n / total) * 100).toFixed(0)}%)
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
