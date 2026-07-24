import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OwnerProfileForm } from "@/components/business-portal/owner-profile-form";
import { DetailRow } from "@/components/business-portal/portal-ui";
import {
  loadPortalBusiness,
  requirePortalBusiness,
} from "@/lib/business-portal/load-portal-business";
import { getCurrentProfile } from "@/lib/auth/require-admin";
import { businessMemberService } from "@/services/business-portal/business-member.service";
import { createAdminClient } from "@/lib/supabase/admin";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ businessId: string }>;
}): Promise<Metadata> {
  const { businessId } = await params;
  const business = await loadPortalBusiness(businessId);
  return {
    title: business ? `Profile · ${business.name}` : "Profile",
  };
}

export default async function BusinessOwnerProfilePage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const { business, membership, user } =
    await requirePortalBusiness(businessId);
  const profile = await getCurrentProfile();

  const displayName =
    profile?.full_name ??
    (user.user_metadata?.full_name as string | undefined) ??
    "";
  const email = profile?.email ?? user.email ?? "";

  const memberships = await businessMemberService.listActiveForUser(user.id);
  const admin = createAdminClient();
  const bizIds = memberships.map((m) => m.business_id);
  const { data: businesses } =
    bizIds.length > 0
      ? await admin.from("businesses").select("id, name").in("id", bizIds)
      : { data: [] as { id: string; name: string }[] };

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <div className="space-y-2">
        <Badge variant="secondary" className="capitalize">
          {membership.role}
        </Badge>
        <h1 className="text-3xl font-semibold tracking-tight">Your profile</h1>
        <p className="text-muted-foreground">
          Your identity while managing {business.name}.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Edit profile</CardTitle>
        </CardHeader>
        <CardContent>
          <OwnerProfileForm
            initialName={displayName}
            initialPhone={profile?.phone ?? ""}
            email={email}
            notifyClaimUpdates={profile?.notify_claim_updates ?? true}
            businesses={businesses ?? []}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Membership</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <DetailRow
            label="Portal role"
            value={<span className="capitalize">{membership.role}</span>}
          />
          <DetailRow
            label="Status"
            value={<span className="capitalize">{membership.status}</span>}
          />
          <DetailRow
            label="Member since"
            value={new Date(membership.created_at).toLocaleDateString()}
          />
          <DetailRow label="Business" value={business.name} />
        </CardContent>
      </Card>
    </div>
  );
}
