"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";

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
  if (next) redirectTo.searchParams.set("next", next);

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
  const parsed = emailSchema.safeParse({
    email: formData.get("email"),
    next: formData.get("next") ?? undefined,
  });

  if (!parsed.success) {
    return { status: "error", message: "Please enter a valid email address." };
  }

  const supabase = await createClient();
  const emailRedirectTo = new URL("/auth/callback", env.NEXT_PUBLIC_SITE_URL);
  if (parsed.data.next) {
    emailRedirectTo.searchParams.set("next", parsed.data.next);
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
  await supabase.auth.signOut();
  redirect("/");
}
