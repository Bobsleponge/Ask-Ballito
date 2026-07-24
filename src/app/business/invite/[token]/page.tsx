import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AcceptInviteButton } from "@/components/business-portal/accept-invite-button";
import { requireUser, AuthRequiredError } from "@/lib/auth/require-admin";
import { businessInviteService } from "@/services/business-portal/business-invite.service";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "Accept invite",
};

export default async function AcceptInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  let user;
  try {
    user = await requireUser();
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      redirect(
        `/?auth=signin&next=${encodeURIComponent(`/business/invite/${token}`)}`,
      );
    }
    throw error;
  }

  const invite = await businessInviteService.getByToken(token);
  if (!invite) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16">
        <h1 className="text-2xl font-semibold">Invite not found</h1>
        <p className="mt-2 text-muted-foreground">
          This invite link is invalid or has been removed.
        </p>
        <Button asChild className="mt-6">
          <Link href="/business/dashboard">Go to dashboard</Link>
        </Button>
      </main>
    );
  }

  const admin = createAdminClient();
  const { data: business } = await admin
    .from("businesses")
    .select("name")
    .eq("id", invite.business_id)
    .maybeSingle();

  const expired = new Date(invite.expires_at).getTime() < Date.now();
  const emailMatch =
    user.email?.trim().toLowerCase() === invite.email.toLowerCase();

  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle>Join {business?.name ?? "a business"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p>
            You&apos;ve been invited as a{" "}
            <Badge variant="secondary" className="capitalize">
              {invite.role}
            </Badge>
          </p>
          <p className="text-muted-foreground">
            Invite email: <strong>{invite.email}</strong>
          </p>
          <p className="text-muted-foreground">
            Signed in as: <strong>{user.email}</strong>
          </p>
          {invite.status !== "pending" ? (
            <p className="text-amber-700">
              This invite is {invite.status} and can no longer be accepted.
            </p>
          ) : expired ? (
            <p className="text-amber-700">This invite has expired.</p>
          ) : !emailMatch ? (
            <p className="text-amber-700">
              Sign in with {invite.email} to accept this invite.
            </p>
          ) : (
            <AcceptInviteButton token={token} />
          )}
        </CardContent>
      </Card>
    </main>
  );
}
