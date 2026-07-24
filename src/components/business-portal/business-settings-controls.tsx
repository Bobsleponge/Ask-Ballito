"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  leaveBusinessAction,
  updateBusinessNotificationsAction,
} from "@/lib/business-portal/actions";

export function BusinessSettingsControls({
  businessId,
  role,
  notifySpecialReminders,
  notifyTeamUpdates,
}: {
  businessId: string;
  role: string;
  notifySpecialReminders: boolean;
  notifyTeamUpdates: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [specials, setSpecials] = useState(notifySpecialReminders);
  const [team, setTeam] = useState(notifyTeamUpdates);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h3 className="font-medium">Notifications</h3>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={specials}
            onChange={(e) => setSpecials(e.target.checked)}
          />
          Special reminders
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={team}
            onChange={(e) => setTeam(e.target.checked)}
          />
          Team updates
        </label>
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await updateBusinessNotificationsAction({
                businessId,
                notifySpecialReminders: specials,
                notifyTeamUpdates: team,
              });
              if (!result.ok) toast.error(result.error);
              else {
                toast.success("Preferences saved");
                router.refresh();
              }
            })
          }
        >
          Save preferences
        </Button>
      </div>

      {role === "manager" ? (
        <div className="space-y-2 rounded-lg border border-destructive/30 p-4">
          <h3 className="font-medium text-destructive">Leave business</h3>
          <p className="text-sm text-muted-foreground">
            Remove your manager access to this portal.
          </p>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await leaveBusinessAction({ businessId });
                if (!result.ok) toast.error(result.error);
                else {
                  toast.success("You left the business");
                  router.push("/business/dashboard");
                  router.refresh();
                }
              })
            }
          >
            Leave business
          </Button>
        </div>
      ) : null}
    </div>
  );
}
