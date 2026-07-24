"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

/**
 * Export the signed-in user's profile, conversations, and memberships as JSON.
 */
export async function exportMyDataAction(): Promise<
  ActionResult<{
    exportedAt: string;
    profile: unknown;
    conversations: unknown[];
    memberships: unknown[];
    claims: unknown[];
  }>
> {
  try {
    const user = await requireUser();
    const admin = createAdminClient();

    const [{ data: profile }, { data: conversations }, { data: memberships }, { data: claims }] =
      await Promise.all([
        admin.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        admin
          .from("conversations")
          .select("id, city_slug, title, created_at, updated_at, sticky_summary")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(200),
        admin
          .from("business_members")
          .select("business_id, role, status, created_at")
          .eq("user_id", user.id),
        admin
          .from("business_claims")
          .select(
            "id, business_id, status, claimant_role, verification_method, submitted_at",
          )
          .eq("user_id", user.id),
      ]);

    return {
      ok: true,
      data: {
        exportedAt: new Date().toISOString(),
        profile,
        conversations: conversations ?? [],
        memberships: memberships ?? [],
        claims: claims ?? [],
      },
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Export failed";
    return { ok: false, error: message };
  }
}

const deleteSchema = z.object({
  confirm: z.literal("DELETE"),
});

/**
 * Permanently delete the signed-in Auth user (cascades profiles via FK).
 */
export async function deleteMyAccountAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const parsed = deleteSchema.safeParse({
      confirm: String(formData.get("confirm") ?? ""),
    });
    if (!parsed.success) {
      return {
        ok: false,
        error: 'Type DELETE to confirm account deletion',
      };
    }

    const admin = createAdminClient();
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) {
      return { ok: false, error: error.message };
    }

    const supabase = await createClient();
    await supabase.auth.signOut({ scope: "global" });
    redirect("/");
  } catch (error) {
    // redirect() throws NEXT_REDIRECT — rethrow
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT")
    ) {
      throw error;
    }
    const message =
      error instanceof Error ? error.message : "Delete failed";
    return { ok: false, error: message };
  }
}
