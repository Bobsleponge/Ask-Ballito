"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  archiveBusinessSpecialAction,
  deleteBusinessSpecialAction,
  duplicateBusinessSpecialAction,
} from "@/lib/business-portal/actions";

export function SpecialActions({
  businessId,
  specialId,
  status,
}: {
  businessId: string;
  specialId: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap gap-2">
      {status !== "archived" ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await archiveBusinessSpecialAction({
                businessId,
                specialId,
              });
              if (!result.ok) toast.error(result.error);
              else {
                toast.success("Archived");
                router.refresh();
              }
            })
          }
        >
          Archive
        </Button>
      ) : null}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await duplicateBusinessSpecialAction({
              businessId,
              specialId,
            });
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            toast.success("Duplicated as draft");
            router.push(
              `/business/dashboard/${businessId}/specials/${result.data.specialId}`,
            );
            router.refresh();
          })
        }
      >
        Duplicate
      </Button>
      {status !== "active" ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await deleteBusinessSpecialAction({
                businessId,
                specialId,
              });
              if (!result.ok) toast.error(result.error);
              else {
                toast.success("Deleted");
                router.refresh();
              }
            })
          }
        >
          Delete
        </Button>
      ) : null}
    </div>
  );
}
