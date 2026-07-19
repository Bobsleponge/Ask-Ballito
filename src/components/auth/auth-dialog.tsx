"use client";

import { useActionState, useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  signInWithGoogle,
  signInWithMagicLink,
  type AuthActionState,
} from "@/lib/auth/actions";
import { analytics } from "@/lib/analytics/events";

const initialState: AuthActionState = { status: "idle" };

export function AuthDialog({
  trigger,
  next,
}: {
  trigger: React.ReactNode;
  next?: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    signInWithMagicLink,
    initialState,
  );
  const [googlePending, startGoogle] = useTransition();

  function handleGoogle() {
    analytics.capture("auth_started", { method: "google" });
    startGoogle(async () => {
      await signInWithGoogle(next);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sign in to Ask Ballito</DialogTitle>
          <DialogDescription>
            Save your conversations and get tailored local recommendations.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={handleGoogle}
            disabled={googlePending}
          >
            <GoogleIcon className="size-4" />
            {googlePending ? "Redirecting..." : "Continue with Google"}
          </Button>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <Separator className="flex-1" />
            or
            <Separator className="flex-1" />
          </div>

          <form
            action={formAction}
            className="flex flex-col gap-3"
            onSubmit={() => analytics.capture("auth_started", { method: "magic_link" })}
          >
            {next ? <input type="hidden" name="next" value={next} /> : null}
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </div>
            <Button type="submit" disabled={pending}>
              {pending ? "Sending..." : "Send magic link"}
            </Button>
          </form>

          {state.status !== "idle" && state.message ? (
            <p
              className={
                state.status === "error"
                  ? "text-sm text-destructive"
                  : "text-sm text-emerald-600 dark:text-emerald-400"
              }
            >
              {state.message}
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09a6.6 6.6 0 0 1 0-4.18V7.07H2.18a11 11 0 0 0 0 9.86l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}
