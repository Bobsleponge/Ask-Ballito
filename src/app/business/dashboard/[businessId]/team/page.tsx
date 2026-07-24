import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  DeactivateMemberButton,
  RevokeInviteButton,
  TeamInviteForm,
} from "@/components/business-portal/team-invite-controls";
import { PortalEmpty, PortalSection } from "@/components/business-portal/portal-ui";
import {
  loadPortalBusiness,
  requirePortalBusiness,
} from "@/lib/business-portal/load-portal-business";
import { businessMemberService } from "@/services/business-portal/business-member.service";
import { businessInviteService } from "@/services/business-portal/business-invite.service";
import { createAdminClient } from "@/lib/supabase/admin";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ businessId: string }>;
}): Promise<Metadata> {
  const { businessId } = await params;
  const business = await loadPortalBusiness(businessId);
  return { title: business ? `Team · ${business.name}` : "Team" };
}

export default async function BusinessTeamPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const { business, membership: currentMembership } =
    await requirePortalBusiness(businessId);

  const isOwner = currentMembership.role === "owner";
  const [members, invites] = await Promise.all([
    businessMemberService.listMembersForBusiness(businessId),
    isOwner ? businessInviteService.list(businessId) : Promise.resolve([]),
  ]);

  const admin = createAdminClient();
  const userIds = members.map((m) => m.user_id);
  const { data: profiles } =
    userIds.length > 0
      ? await admin
          .from("profiles")
          .select("id, email, full_name")
          .in("id", userIds)
      : {
          data: [] as {
            id: string;
            email: string | null;
            full_name: string | null;
          }[],
        };

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const pendingInvites = invites.filter((i) => i.status === "pending");

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Team</h1>
        <p className="text-muted-foreground">
          People with access to {business.name}.
        </p>
      </div>

      {isOwner ? (
        <PortalSection
          title="Invite managers"
          description="Create a link and send it to their email. They must sign in with that address."
        >
          <TeamInviteForm businessId={businessId} />
          {pendingInvites.length > 0 ? (
            <div className="mt-4 space-y-2">
              {pendingInvites.map((invite) => (
                <Card key={invite.id}>
                  <CardContent className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                    <div>
                      <p className="font-medium">{invite.email}</p>
                      <p className="text-xs text-muted-foreground">
                        Expires {new Date(invite.expires_at).toLocaleDateString()}
                      </p>
                    </div>
                    <RevokeInviteButton
                      businessId={businessId}
                      inviteId={invite.id}
                    />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : null}
        </PortalSection>
      ) : null}

      {members.length === 0 ? (
        <PortalEmpty
          title="No team members"
          description="Something went wrong — your membership should appear here."
        />
      ) : (
        <PortalSection title="Members">
          <div className="space-y-3">
            {members.map((member) => {
              const profile = profileById.get(member.user_id);
              const isYou = member.id === currentMembership.id;
              return (
                <Card key={member.id}>
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                    <div>
                      <p className="font-medium">
                        {profile?.full_name ?? profile?.email ?? "Team member"}
                        {isYou ? (
                          <span className="ml-2 text-xs font-normal text-muted-foreground">
                            (you)
                          </span>
                        ) : null}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {profile?.email ?? member.user_id}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="capitalize">
                        {member.role}
                      </Badge>
                      <Badge
                        variant={
                          member.status === "active" ? "outline" : "destructive"
                        }
                        className="capitalize"
                      >
                        {member.status}
                      </Badge>
                      {isOwner &&
                      !isYou &&
                      member.role === "manager" &&
                      member.status === "active" ? (
                        <DeactivateMemberButton
                          businessId={businessId}
                          memberId={member.id}
                        />
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </PortalSection>
      )}
    </div>
  );
}
