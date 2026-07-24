import { redirect } from "next/navigation";
import {
  AuthRequiredError,
  requireUser,
} from "@/lib/auth/require-admin";
import { getCurrentProfile } from "@/lib/auth/require-admin";
import { getHeaderAuth } from "@/lib/auth/header-auth";
import { toSessionUser } from "@/lib/auth/session-user";
import { BusinessPortalHeader } from "@/components/business-portal/business-portal-header";
import { businessMemberService } from "@/services/business-portal/business-member.service";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function BusinessLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let user;
  try {
    user = await requireUser();
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      redirect(
        `/?auth=signin&next=${encodeURIComponent("/business/dashboard")}`,
      );
    }
    throw error;
  }

  const [memberships, profile, { isAdmin }] = await Promise.all([
    businessMemberService.listActiveForUser(user.id),
    getCurrentProfile(),
    getHeaderAuth(),
  ]);

  const sessionUser = toSessionUser(user)!;
  const primary = memberships[0] ?? null;

  const businessNames: Record<string, string> = {};
  if (memberships.length > 0) {
    const admin = createAdminClient();
    const ids = memberships.map((m) => m.business_id);
    const { data } = await admin
      .from("businesses")
      .select("id, name")
      .in("id", ids);
    for (const row of data ?? []) {
      businessNames[row.id] = row.name;
    }
  }

  // Prefer display name from profile for owner identity.
  if (profile?.full_name && sessionUser) {
    sessionUser.name = profile.full_name;
  }
  if (profile?.email && sessionUser) {
    sessionUser.email = profile.email;
  }

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-teal-50/40 dark:bg-background">
      <BusinessPortalHeader
        user={sessionUser}
        businessNames={businessNames}
        fallbackBusinessId={primary?.business_id}
        isAdmin={isAdmin}
      />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
        {children}
      </main>
    </div>
  );
}
