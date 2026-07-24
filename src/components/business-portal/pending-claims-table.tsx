"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  approveAndIngestBusinessClaimAction,
  approveBusinessClaimAction,
  ingestBusinessForSearchAction,
  rejectBusinessClaimAction,
} from "@/lib/business-portal/actions";
import type { PendingClaimDetail } from "@/services/business-portal/business-claim.service";

export function PendingClaimsTable({ claims }: { claims: PendingClaimDetail[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [detail, setDetail] = useState<PendingClaimDetail | null>(null);
  const [rejectTarget, setRejectTarget] = useState<PendingClaimDetail | null>(
    null,
  );
  const [reason, setReason] = useState("");

  function refresh() {
    router.refresh();
  }

  function handleApprove(claim: PendingClaimDetail) {
    startTransition(async () => {
      const result = await approveBusinessClaimAction(claim.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Approved claim for ${claim.businessName}`);
      setDetail(null);
      refresh();
    });
  }

  function handleIngest(claim: PendingClaimDetail, force = false) {
    startTransition(async () => {
      const result = await ingestBusinessForSearchAction({
        businessId: claim.business_id,
        force,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (result.data.alreadyIngested) {
        toast.message("Already ingested — use force only if re-running");
        return;
      }
      toast.success(
        `Ingested ${claim.businessName}: +${result.data.servicesAdded} services, +${result.data.keywordsAdded} keywords`,
      );
      refresh();
    });
  }

  function handleApproveAndIngest(claim: PendingClaimDetail) {
    startTransition(async () => {
      const result = await approveAndIngestBusinessClaimAction({
        claimId: claim.id,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `Approved & ingested ${claim.businessName} (+${result.data.servicesAdded} services)`,
      );
      setDetail(null);
      refresh();
    });
  }

  function handleReject() {
    if (!rejectTarget) return;
    startTransition(async () => {
      const result = await rejectBusinessClaimAction({
        claimId: rejectTarget.id,
        reason,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Rejected claim for ${rejectTarget.businessName}`);
      setRejectTarget(null);
      setReason("");
      setDetail(null);
      refresh();
    });
  }

  if (claims.length === 0) {
    return (
      <p className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
        No pending claims right now.
      </p>
    );
  }

  return (
    <>
      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Business</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Search</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {claims.map((claim) => (
              <TableRow key={claim.id}>
                <TableCell>
                  <div className="space-y-0.5">
                    <p className="font-medium whitespace-normal">
                      {claim.businessName}
                    </p>
                    {claim.businessAddress ? (
                      <p className="text-xs text-muted-foreground whitespace-normal">
                        {claim.businessAddress}
                      </p>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-0.5">
                    <p className="whitespace-normal">{claim.claimant_name}</p>
                    <p className="text-xs text-muted-foreground whitespace-normal">
                      {claim.claimant_email}
                    </p>
                  </div>
                </TableCell>
                <TableCell>
                  {new Date(claim.submitted_at).toLocaleString()}
                </TableCell>
                <TableCell>
                  {claim.searchIngestedAt ? (
                    <Badge variant="secondary">Ingested</Badge>
                  ) : (
                    <Badge variant="outline">Needs ingest</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-wrap justify-end gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => setDetail(claim)}
                    >
                      View Details
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pending || Boolean(claim.searchIngestedAt)}
                      onClick={() => handleIngest(claim)}
                    >
                      Ingest
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={pending}
                      onClick={() => handleApproveAndIngest(claim)}
                    >
                      Approve & Ingest
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={pending}
                      onClick={() => handleApprove(claim)}
                    >
                      Approve
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={pending}
                      onClick={() => {
                        setRejectTarget(claim);
                        setReason("");
                      }}
                    >
                      Reject
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={detail != null} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="sm:max-w-lg">
          {detail ? (
            <>
              <DialogHeader>
                <DialogTitle>{detail.businessName}</DialogTitle>
                <DialogDescription>Claim details</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{detail.status}</Badge>
                  <Badge variant="outline">{detail.claimant_role}</Badge>
                  {detail.searchIngestedAt ? (
                    <Badge variant="secondary">Search ingested</Badge>
                  ) : (
                    <Badge variant="outline">Needs search ingest</Badge>
                  )}
                </div>
                <DetailRow label="Claimant" value={detail.claimant_name} />
                <DetailRow label="Email" value={detail.claimant_email} />
                <DetailRow label="Phone" value={detail.claimant_phone} />
                <DetailRow
                  label="Account"
                  value={
                    detail.claimantProfileEmail ??
                    detail.claimantProfileName ??
                    detail.user_id
                  }
                />
                <DetailRow
                  label="Submitted"
                  value={new Date(detail.submitted_at).toLocaleString()}
                />
                <DetailRow
                  label="Notes"
                  value={detail.notes?.trim() ? detail.notes : "—"}
                />
                <DetailRow
                  label="Verification"
                  value={detail.verification_method}
                />
                <DetailRow
                  label="Search ingest"
                  value={
                    detail.searchIngestedAt
                      ? new Date(detail.searchIngestedAt).toLocaleString()
                      : "Not run yet"
                  }
                />
              </div>
              <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="destructive"
                  disabled={pending}
                  onClick={() => {
                    setRejectTarget(detail);
                    setReason("");
                  }}
                >
                  Reject
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending || Boolean(detail.searchIngestedAt)}
                  onClick={() => handleIngest(detail)}
                >
                  Ingest
                </Button>
                <Button
                  type="button"
                  disabled={pending}
                  onClick={() => handleApproveAndIngest(detail)}
                >
                  Approve & Ingest
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={pending}
                  onClick={() => handleApprove(detail)}
                >
                  Approve only
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={rejectTarget != null}
        onOpenChange={(open) => {
          if (!open) {
            setRejectTarget(null);
            setReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject claim</DialogTitle>
            <DialogDescription>
              {rejectTarget
                ? `Provide a reason for rejecting ${rejectTarget.businessName}. The claim will be kept for audit.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rejectionReason">Reason</Label>
            <Textarea
              id="rejectionReason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this claim was rejected"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setRejectTarget(null);
                setReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending || reason.trim().length < 3}
              onClick={handleReject}
            >
              Confirm reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="whitespace-pre-wrap">{value}</p>
    </div>
  );
}
