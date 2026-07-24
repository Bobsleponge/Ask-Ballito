"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setAbuseSuspendedAction } from "@/lib/admin/ai-usage-actions";

export function AbuseSuspendButton({
  userId,
  suspended,
}: {
  userId: string;
  suspended: boolean;
}) {
  const [pending, start] = useTransition();

  return (
    <Button
      type="button"
      size="sm"
      variant={suspended ? "outline" : "destructive"}
      disabled={pending}
      onClick={() => {
        start(async () => {
          const result = await setAbuseSuspendedAction({
            userId,
            suspended: !suspended,
          });
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success(suspended ? "Chat restored" : "User suspended from chat");
        });
      }}
    >
      {suspended ? "Unsuspend" : "Suspend chat"}
    </Button>
  );
}
