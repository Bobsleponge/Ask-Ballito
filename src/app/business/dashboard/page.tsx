import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DEFAULT_CITY_SLUG } from "@/config/cities";
import { requireUser } from "@/lib/auth/require-admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { businessMemberService } from "@/services/business-portal/business-member.service";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "Business dashboard",
};

export default async function BusinessDashboardIndexPage() {
  const user = await requireUser();
  const memberships = await businessMemberService.listActiveForUser(user.id);

  if (memberships.length === 1) {
    redirect(`/business/dashboard/${memberships[0].business_id}`);
  }

  const admin = createAdminClient();
  const businessIds = memberships.map((m) => m.business_id);
  const { data: businesses } =
    businessIds.length > 0
      ? await admin
          .from("businesses")
          .select("id, name, city_slug, address")
          .in("id", businessIds)
      : { data: [] as { id: string; name: string; city_slug: string; address: string | null }[] };

  const businessById = new Map((businesses ?? []).map((b) => [b.id, b]));

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          Your businesses
        </h1>
        <p className="text-muted-foreground">
          Select a business to open its owner portal.
        </p>
      </div>

      {memberships.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No businesses yet</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              You do not have an active business membership. Claim your listing
              to get started.
            </p>
            <Button asChild>
              <Link href={`/${DEFAULT_CITY_SLUG}/business/claim`}>
                Claim a business
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {memberships.map((membership) => {
            const business = businessById.get(membership.business_id);
            return (
              <Card key={membership.id}>
                <CardContent className="flex items-center justify-between gap-4 py-4">
                  <div>
                    <p className="font-medium">
                      {business?.name ?? "Business"}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {membership.role}
                      {business?.address ? ` · ${business.address}` : null}
                    </p>
                  </div>
                  <Button asChild size="sm">
                    <Link
                      href={`/business/dashboard/${membership.business_id}`}
                    >
                      Open
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
