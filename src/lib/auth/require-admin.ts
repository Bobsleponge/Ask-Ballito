import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth/user";
import type { ProfileRow } from "@/types/database";

export class AuthRequiredError extends Error {
  readonly status = 401;
  constructor(message = "Authentication required") {
    super(message);
    this.name = "AuthRequiredError";
  }
}

export class ForbiddenError extends Error {
  readonly status = 403;
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * Require an authenticated user. Throws AuthRequiredError if missing.
 */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new AuthRequiredError();
  return user;
}

/**
 * Require an authenticated user for page routes; redirects to city home with
 * next= path when unauthenticated.
 */
export async function requireUserOrRedirect(nextPath: string): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    const next = encodeURIComponent(nextPath);
    redirect(`/?auth=signin&next=${next}`);
  }
  return user;
}

/**
 * Load the signed-in user's profile.
 *
 * Uses the service-role client keyed by the already-verified auth user id so
 * brief local clock skew ("JWT issued at future") does not break portal pages
 * after a successful sign-in.
 */
export const getCurrentProfile = cache(async (): Promise<ProfileRow | null> => {
  const user = await getCurrentUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select(
      "id, email, full_name, avatar_url, phone, is_admin, abuse_suspended, notify_claim_updates, created_at, updated_at",
    )
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw new Error(`Failed to load profile: ${error.message}`);
  return data;
});

/**
 * Load the authenticated user's profile and verify is_admin === true.
 * Throws 401 if unauthenticated, 403 if not an admin.
 */
export async function requireAdmin(): Promise<{
  user: User;
  profile: ProfileRow;
}> {
  const user = await requireUser();
  const profile = await getCurrentProfile();
  if (!profile) throw new ForbiddenError("Profile not found");
  if (!profile.is_admin) throw new ForbiddenError("Admin access required");
  return { user, profile };
}

/**
 * Page-level admin gate. Redirects non-admins to home.
 */
export async function requireAdminOrRedirect(): Promise<{
  user: User;
  profile: ProfileRow;
}> {
  const user = await getCurrentUser();
  if (!user) redirect("/?auth=signin&next=/admin");

  const profile = await getCurrentProfile();
  if (!profile?.is_admin) redirect("/");

  return { user, profile };
}
