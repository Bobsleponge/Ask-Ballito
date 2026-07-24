"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  deactivateBusinessMemberAction,
  inviteBusinessManagerAction,
  revokeBusinessInviteAction,
} from "@/lib/business-portal/actions";

export function TeamInviteForm({ businessId }: { businessId: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();
  const [lastLink, setLastLink] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await inviteBusinessManagerAction({ businessId, email });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const origin = window.location.origin;
      const link = `${origin}${result.data.acceptPath}`;
      setLastLink(link);
      setEmail("");
      toast.success("Invite created — copy the link to share");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="invite-email">Invite manager by email</Label>
        <div className="flex gap-2">
          <Input
            id="invite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="colleague@example.com"
            required
          />
          <Button type="submit" disabled={pending}>
            {pending ? "…" : "Invite"}
          </Button>
        </div>
      </div>
      {lastLink ? (
        <div className="rounded-md border bg-muted/40 p-3 text-xs break-all">
          <p className="mb-1 font-medium">Invite link</p>
          <p>{lastLink}</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-2"
            onClick={() => {
              void navigator.clipboard.writeText(lastLink);
              toast.success("Copied");
            }}
          >
            Copy link
          </Button>
        </div>
      ) : null}
    </form>
  );
}

export function RevokeInviteButton({
  businessId,
  inviteId,
}: {
  businessId: string;
  inviteId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await revokeBusinessInviteAction({
            businessId,
            inviteId,
          });
          if (!result.ok) toast.error(result.error);
          else {
            toast.success("Invite revoked");
            router.refresh();
          }
        })
      }
    >
      Revoke
    </Button>
  );
}

export function DeactivateMemberButton({
  businessId,
  memberId,
}: {
  businessId: string;
  memberId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await deactivateBusinessMemberAction({
            businessId,
            memberId,
          });
          if (!result.ok) toast.error(result.error);
          else {
            toast.success("Member deactivated");
            router.refresh();
          }
        })
      }
    >
      Deactivate
    </Button>
  );
}
