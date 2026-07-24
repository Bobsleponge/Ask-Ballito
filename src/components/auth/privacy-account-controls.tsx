"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  deleteMyAccountAction,
  exportMyDataAction,
} from "@/lib/auth/privacy-actions";

export function PrivacyAccountControls() {
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState("");

  return (
    <div className="space-y-6 rounded-xl border border-border/70 p-4">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Your data</h2>
        <p className="text-sm text-muted-foreground">
          Download a JSON export of your profile, conversations, memberships,
          and claims. You must be signed in.
        </p>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => {
            start(async () => {
              const result = await exportMyDataAction();
              if (!result.ok || !result.data) {
                toast.error(result.ok ? "Export failed" : result.error);
                return;
              }
              const blob = new Blob([JSON.stringify(result.data, null, 2)], {
                type: "application/json",
              });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `ask-ballito-export-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
              toast.success("Export downloaded");
            });
          }}
        >
          Download my data
        </Button>
      </div>

      <div className="space-y-2 border-t border-border/60 pt-4">
        <h2 className="text-lg font-semibold text-destructive">
          Delete account
        </h2>
        <p className="text-sm text-muted-foreground">
          Permanently deletes your Auth account and cascaded profile data. Type{" "}
          <code className="text-xs">DELETE</code> to confirm.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="DELETE"
            className="max-w-xs"
            autoComplete="off"
          />
          <Button
            type="button"
            variant="destructive"
            disabled={pending || confirm !== "DELETE"}
            onClick={() => {
              start(async () => {
                const fd = new FormData();
                fd.set("confirm", confirm);
                const result = await deleteMyAccountAction(fd);
                if (result && !result.ok) {
                  toast.error(result.error);
                }
              });
            }}
          >
            Delete my account
          </Button>
        </div>
      </div>
    </div>
  );
}
