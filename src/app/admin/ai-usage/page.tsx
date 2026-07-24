import type { Metadata } from "next";
import Link from "next/link";
import { loadTopAiUsage } from "@/lib/admin/ai-usage-actions";
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

export default async function AdminAiUsagePage() {
  const { rows, totalEstimatedCostUsd, totalCalls } = await loadTopAiUsage(25);

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
