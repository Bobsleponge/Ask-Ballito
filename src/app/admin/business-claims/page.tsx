import type { Metadata } from "next";
import { PendingClaimsTable } from "@/components/business-portal/pending-claims-table";
import { businessClaimService } from "@/services/business-portal/business-claim.service";

export const metadata: Metadata = {
  title: "Business claims",
};

export default async function AdminBusinessClaimsPage() {
  const claims = await businessClaimService.listPendingClaims();

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          Pending claims
        </h1>
        <p className="text-muted-foreground">
          Approve or reject ownership claims. Use{" "}
          <span className="font-medium text-foreground">Approve & Ingest</span>{" "}
          to study listing data once for search; later owner updates restudy on
          a 48-hour batch.
        </p>
      </div>
      <PendingClaimsTable claims={claims} />
    </div>
  );
}
