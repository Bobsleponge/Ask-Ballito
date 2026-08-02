import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardCheck, Building2, Activity, Gauge } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { businessClaimService } from "@/services/business-portal/business-claim.service";

export const metadata: Metadata = {
  title: "Admin",
};

export default async function AdminHomePage() {
  const pending = await businessClaimService.listPendingClaims();

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Admin portal</h1>
        <p className="max-w-2xl text-muted-foreground">
          Manage Ask Ballito operations — claims, search quality, AI usage, and
          abuse controls.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/admin/business-claims" className="group">
          <Card className="h-full transition-colors group-hover:bg-muted/40">
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
              <div className="space-y-1">
                <CardTitle className="text-lg">Business claims</CardTitle>
                <p className="text-sm font-normal text-muted-foreground">
                  Approve or reject ownership claims from business owners.
                </p>
              </div>
              <ClipboardCheck className="size-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold tabular-nums">
                {pending.length}
              </p>
              <p className="text-sm text-muted-foreground">pending review</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/search-quality" className="group">
          <Card className="h-full transition-colors group-hover:bg-muted/40">
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
              <div className="space-y-1">
                <CardTitle className="text-lg">Search quality</CardTitle>
                <p className="text-sm font-normal text-muted-foreground">
                  Top-k accuracy, AI cost, latency, and coverage gaps.
                </p>
              </div>
              <Gauge className="size-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Eval platform · gold dataset
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/ai-usage" className="group">
          <Card className="h-full transition-colors group-hover:bg-muted/40">
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
              <div className="space-y-1">
                <CardTitle className="text-lg">AI usage</CardTitle>
                <p className="text-sm font-normal text-muted-foreground">
                  Top chat consumers and abuse suspend controls.
                </p>
              </div>
              <Activity className="size-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Last 7 days · suspend chat
              </p>
            </CardContent>
          </Card>
        </Link>

        <Card className="h-full opacity-70">
          <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
            <div className="space-y-1">
              <CardTitle className="text-lg">Businesses</CardTitle>
              <p className="text-sm font-normal text-muted-foreground">
                Directory tools and membership management — coming soon.
              </p>
            </div>
            <Building2 className="size-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Not available yet</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
