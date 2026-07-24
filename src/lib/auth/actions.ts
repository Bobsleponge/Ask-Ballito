"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { safeRedirectPath } from "@/lib/security/safe-redirect";
import {
  checkMagicLinkRateLimit,
  getClientIpFromHeaders,
  isRateLimitConfigured,
} from "@/lib/security/rate-limit";
import { captureAbuseEvent } from "@/lib/security/abuse-events";
import {
  getDemoAccountCredentials,
  isDemoLoginEnabled,
  type DemoAccountRole,
} from "@/lib/auth/demo-accounts";

const emailSchema = z.object({
  email: z.string().email(),
  next: z.string().optional(),
});

export type AuthActionState = {
  status: "idle" | "success" | "error";
  message?: string;
};

/**
 * Start Google OAuth. Redirects the browser to Google's consent screen.
 */
export async function signInWithGoogle(next?: string): Promise<void> {
  const supabase = await createClient();
  const redirectTo = new URL("/auth/callback", env.NEXT_PUBLIC_SITE_URL);
  const safeNext = safeRedirectPath(next);
  if (safeNext !== "/") {
    redirectTo.searchParams.set("next", safeNext);
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: redirectTo.toString() },
  });

  if (error) {
    redirect(`/?auth_error=${encodeURIComponent(error.message)}`);
  }

  if (data.url) {
    redirect(data.url);
  }
}

/**
 * Send a passwordless email magic link.
 */
export async function signInWithMagicLink(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  if (env.NODE_ENV === "production" && !isRateLimitConfigured()) {
    return {
      status: "error",
      message: "Sign-in is temporarily unavailable. Please try again later.",
    };
  }

  const parsed = emailSchema.safeParse({
    email: formData.get("email"),
    next: formData.get("next") ?? undefined,
  });

  if (!parsed.success) {
    return { status: "error", message: "Please enter a valid email address." };
  }

  const h = await headers();
  const ip = getClientIpFromHeaders(h);
  const emailKey = parsed.data.email.trim().toLowerCase();

  const byIp = await checkMagicLinkRateLimit(`ip:${ip}`);
  const byEmail = await checkMagicLinkRateLimit(`email:${emailKey}`);
  if (
    (!byIp.configured || !byEmail.configured) &&
    env.NODE_ENV === "production"
  ) {
    return {
      status: "error",
      message: "Sign-in is temporarily unavailable. Please try again later.",
    };
  }
  if (!byIp.success || !byEmail.success) {
    captureAbuseEvent({
      event: "magic_link_rate_limited",
      distinctId: emailKey,
      properties: { ip },
    });
    return {
      status: "error",
      message: "Too many sign-in attempts. Please wait and try again.",
    };
  }

  const supabase = await createClient();
  const emailRedirectTo = new URL("/auth/callback", env.NEXT_PUBLIC_SITE_URL);
  const safeNext = safeRedirectPath(parsed.data.next);
  if (safeNext !== "/") {
    emailRedirectTo.searchParams.set("next", safeNext);
  }

  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { emailRedirectTo: emailRedirectTo.toString() },
  });

  if (error) {
    return { status: "error", message: error.message };
  }

  return {
    status: "success",
    message: "Check your inbox for a magic link to sign in.",
  };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "global" });
  if (error) {
    // Still clear the local session cookies via a hard redirect home.
    console.error("signOut failed:", error.message);
  }
  redirect("/");
}

/**
 * Local/dev quick-login for Admin, Business, and User demo accounts.
 * Disabled in production unless ENABLE_DEMO_LOGIN=true.
 */
export async function signInAsDemoAccount(
  role: DemoAccountRole,
  next?: string,
): Promise<void> {
  if (!isDemoLoginEnabled()) {
    redirect(`/?auth_error=${encodeURIComponent("Demo login is disabled")}`);
  }

  const parsedRole = z.enum(["admin", "business", "user"]).safeParse(role);
  if (!parsedRole.success) {
    redirect(`/?auth_error=${encodeURIComponent("Invalid demo account")}`);
  }

  const { email, password } = getDemoAccountCredentials(parsedRole.data);
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(
      `/?auth_error=${encodeURIComponent(
        `Demo login failed: ${error.message}. Run: npm run seed:demo-accounts`,
      )}`,
    );
  }

  const fallback =
    parsedRole.data === "admin"
      ? "/admin"
      : parsedRole.data === "business"
        ? "/business/dashboard"
        : "/";

  if (next) {
    redirect(safeRedirectPath(next));
  }
  redirect(fallback);
}
