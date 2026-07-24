"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateOwnerProfileAction } from "@/lib/business-portal/actions";

export function OwnerProfileForm({
  initialName,
  initialPhone,
  email,
  notifyClaimUpdates,
  businesses,
}: {
  initialName: string;
  initialPhone: string;
  email: string;
  notifyClaimUpdates: boolean;
  businesses: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [notify, setNotify] = useState(notifyClaimUpdates);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await updateOwnerProfileAction({
        fullName: name,
        phone,
        notifyClaimUpdates: notify,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Profile updated");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="fullName">Display name</Label>
        <Input
          id="fullName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Phone</Label>
        <Input
          id="phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+27 …"
          maxLength={40}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" value={email} disabled />
        <p className="text-xs text-muted-foreground">
          Email is managed by your sign-in provider.
        </p>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={notify}
          onChange={(e) => setNotify(e.target.checked)}
        />
        Email me about claim updates
      </label>
      {businesses.length > 0 ? (
        <div className="space-y-2 rounded-md border p-3">
          <p className="text-sm font-medium">Your businesses</p>
          <ul className="space-y-1 text-sm">
            {businesses.map((b) => (
              <li key={b.id}>
                <a
                  className="text-teal-800 underline-offset-2 hover:underline"
                  href={`/business/dashboard/${b.id}`}
                >
                  {b.name}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <Button type="submit" disabled={pending || !name.trim()}>
        {pending ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}
