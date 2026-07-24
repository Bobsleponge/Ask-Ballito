import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BusinessSettingsControls } from "@/components/business-portal/business-settings-controls";
import { DetailRow, PortalSection } from "@/components/business-portal/portal-ui";
import {
  loadPortalBusiness,
  requirePortalBusiness,
} from "@/lib/business-portal/load-portal-business";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ businessId: string }>;
}): Promise<Metadata> {
  const { businessId } = await params;
  const business = await loadPortalBusiness(businessId);
  return {
    title: business ? `Settings · ${business.name}` : "Settings",
  };
}

export default async function BusinessSettingsPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const { business, membership } = await requirePortalBusiness(businessId);

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Portal preferences for {business.name}.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Business access</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <DetailRow label="Business ID" value={business.id} />
          <DetailRow
            label="Your role"
            value={<span className="capitalize">{membership.role}</span>}
          />
          <DetailRow
            label="Membership status"
            value={
              <Badge variant="outline" className="capitalize">
                {membership.status}
              </Badge>
            }
          />
          <DetailRow
            label="Listing last updated"
            value={new Date(business.updated_at).toLocaleString()}
          />
          {membership.role === "owner" ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/business/dashboard/${businessId}/team`}>
                Manage team invites
              </Link>
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
        </CardHeader>
        <CardContent>
          <BusinessSettingsControls
            businessId={businessId}
            role={membership.role}
            notifySpecialReminders={
              business.profile?.notify_special_reminders ?? true
            }
            notifyTeamUpdates={business.profile?.notify_team_updates ?? true}
          />
        </CardContent>
      </Card>

      <PortalSection
        title="Billing"
        description="Subscriptions and payments are not available yet."
      >
        <Card className="opacity-80">
          <CardContent className="py-4">
            <p className="text-sm font-medium">Coming later</p>
            <p className="text-xs text-muted-foreground">
              Ownership transfer and billing will unlock with subscriptions.
            </p>
          </CardContent>
        </Card>
      </PortalSection>
    </div>
  );
}
