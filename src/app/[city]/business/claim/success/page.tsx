import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCity, getEnabledCities } from "@/config/cities";
import { getHeaderAuth } from "@/lib/auth/header-auth";
import { getCurrentUser } from "@/lib/auth/user";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { businessClaimService } from "@/services/business-portal/business-claim.service";
import { createAdminClient } from "@/lib/supabase/admin";

export function generateStaticParams() {
  return getEnabledCities().map((c) => ({ city: c.slug }));
}

export const metadata: Metadata = {
  title: "Claim submitted",
};

export default async function BusinessClaimSuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ city: string }>;
  searchParams: Promise<{ claimId?: string }>;
}) {
  const { city: slug } = await params;
  const { claimId } = await searchParams;
  const city = getCity(slug);
  if (!city || !city.enabled) notFound();

  const [{ user, isAdmin, hasBusiness }, authUser] = await Promise.all([
    getHeaderAuth(),
    getCurrentUser(),
  ]);

  let businessName: string | null = null;
  if (authUser && claimId) {
    const claim = await businessClaimService.getOwnClaim(authUser.id, claimId);
    if (claim) {
      const admin = createAdminClient();
      const { data: business } = await admin
        .from("businesses")
        .select("name")
        .eq("id", claim.business_id)
        .maybeSingle();
      businessName = business?.name ?? null;
    }
  }

  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <SiteHeader
        city={city}
        user={user}
        isAdmin={isAdmin}
        hasBusiness={hasBusiness}
      />
      <main className="flex flex-1 flex-col">
        <div className="mx-auto w-full max-w-lg px-4 py-16">
          <Card>
            <CardHeader className="space-y-3">
              <Badge variant="secondary" className="w-fit">
                Pending Review
              </Badge>
              <CardTitle className="text-2xl">Claim submitted</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                {businessName
                  ? `Thanks — we received your claim for ${businessName}.`
                  : "Thanks — we received your business claim."}{" "}
                Our team typically reviews claims within{" "}
                <strong className="text-foreground">1–2 business days</strong>.
              </p>
              <ol className="list-decimal space-y-2 pl-4">
                <li>Claim submitted</li>
                <li>Pending admin review</li>
                <li>Business Portal unlocked on approval</li>
              </ol>
              <div className="flex flex-wrap gap-2 pt-2">
                <Button asChild>
                  <Link href={`/${city.slug}`}>Back to Ask Ballito</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href={`/${city.slug}/business/claim`}>
                    Claim another
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
