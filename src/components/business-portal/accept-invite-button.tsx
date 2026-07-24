"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { acceptBusinessInviteAction } from "@/lib/business-portal/actions";

export function AcceptInviteButton({ token }: { token: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await acceptBusinessInviteAction({ token });
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success("Welcome to the team");
          router.push(`/business/dashboard/${result.data.businessId}`);
          router.refresh();
        })
      }
    >
      {pending ? "Accepting…" : "Accept invite"}
    </Button>
  );
}
