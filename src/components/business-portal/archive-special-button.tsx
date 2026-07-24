"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { archiveBusinessSpecialAction } from "@/lib/business-portal/actions";

export function ArchiveSpecialButton({
  businessId,
  specialId,
}: {
  businessId: string;
  specialId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const result = await archiveBusinessSpecialAction({
            businessId,
            specialId,
          });
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success("Special archived");
          router.refresh();
        });
      }}
    >
      {pending ? "Archiving…" : "Archive"}
    </Button>
  );
}
