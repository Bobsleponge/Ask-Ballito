import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  Store,
  Images,
  Tag,
  Users,
  Settings,
  CheckCircle2,
  Circle,
  Star,
  ExternalLink,
  UtensilsCrossed,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DetailRow,
  PortalNavCard,
  PortalSection,
  PortalStat,
} from "@/components/business-portal/portal-ui";
import {
  listingCompleteness,
  loadPortalBusiness,
  requirePortalBusiness,
} from "@/lib/business-portal/load-portal-business";
import { getCurrentProfile } from "@/lib/auth/require-admin";
import { safeHttpUrl } from "@/lib/security/safe-url";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ businessId: string }>;
}): Promise<Metadata> {
  const { businessId } = await params;
  const business = await loadPortalBusiness(businessId);
  return { title: business ? `${business.name} · Portal` : "Business portal" };
}

export default async function BusinessOverviewPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const { business, membership, user } = await requirePortalBusiness(businessId);
  const profile = await getCurrentProfile();
  const completeness = listingCompleteness(business);
  const coverUrl = business.heroUrl ?? business.photos[0]?.url ?? null;
  const website = safeHttpUrl(business.website);

  return (
    <div className="space-y-8">
      <div className="overflow-hidden rounded-2xl border bg-card">
        <div className="relative h-40 bg-teal-950/90 sm:h-52">
          {coverUrl ? (
            <Image
              src={coverUrl}
              alt=""
              fill
              className="object-cover opacity-80"
              sizes="(max-width: 1024px) 100vw, 1024px"
              priority
            />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          {business.logoUrl ? (
            <div className="absolute top-4 left-4 size-14 overflow-hidden rounded-xl border border-white/60 bg-white shadow-sm">
              <Image
                src={business.logoUrl}
                alt=""
                fill
                className="object-cover"
                sizes="56px"
              />
            </div>
          ) : null}
          <div className="absolute right-0 bottom-0 left-0 p-5 sm:p-6">
            <Badge className="mb-2 capitalize">{membership.role}</Badge>
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              {business.name}
            </h1>
            <p className="mt-1 text-sm text-white/80">
              {[business.category, business.address].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <PortalStat
          label="Listing score"
          value={`${completeness.score}%`}
          hint="Profile completeness"
        />
        <PortalStat
          label="Google rating"
          value={
            business.rating != null ? business.rating.toFixed(1) : "—"
          }
          hint={
            business.rating_count != null
              ? `${business.rating_count} reviews`
              : "No reviews yet"
          }
        />
        <PortalStat
          label="Active specials"
          value={String(business.activeSpecialCount)}
          hint={`${business.specials.length} total`}
        />
        <PortalStat
          label="City"
          value={business.city_slug}
          hint="Ask Ballito market"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Listing checklist</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {completeness.checks.map((check) => (
              <div
                key={check.id}
                className="flex items-center gap-2 text-sm"
              >
                {check.done ? (
                  <CheckCircle2 className="size-4 text-teal-700" />
                ) : (
                  <Circle className="size-4 text-muted-foreground" />
                )}
                <span
                  className={
                    check.done ? "text-foreground" : "text-muted-foreground"
                  }
                >
                  {check.label}
                </span>
              </div>
            ))}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href={`/business/dashboard/${businessId}/listing`}>
                  Review listing
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href={`/business/dashboard/${businessId}/offerings`}>
                  Edit offerings
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Signed in as</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <DetailRow
              label="Name"
              value={
                profile?.full_name ??
                (user.user_metadata?.full_name as string | undefined) ??
                "—"
              }
            />
            <DetailRow
              label="Email"
              value={profile?.email ?? user.email ?? "—"}
            />
            <DetailRow
              label="Role"
              value={<span className="capitalize">{membership.role}</span>}
            />
            <Button asChild variant="outline" size="sm">
              <Link href={`/business/dashboard/${businessId}/profile`}>
                Edit profile
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <PortalSection title="Manage" description="Jump into each area of your portal.">
        <div className="grid gap-3 sm:grid-cols-2">
          <PortalNavCard
            href={`/business/dashboard/${businessId}/listing`}
            title="Listing"
            description="Edit description, phone, and website"
            icon={<Store className="size-4" />}
          />
          <PortalNavCard
            href={`/business/dashboard/${businessId}/offerings`}
            title="Offerings"
            description="Services, keywords, and menu options"
            icon={<UtensilsCrossed className="size-4" />}
          />
          <PortalNavCard
            href={`/business/dashboard/${businessId}/branding`}
            title="Branding"
            description="Upload logo and hero image"
            icon={<Images className="size-4" />}
          />
          <PortalNavCard
            href={`/business/dashboard/${businessId}/specials`}
            title="Specials"
            description={`${business.activeSpecialCount} active · manage promotions`}
            icon={<Tag className="size-4" />}
          />
          <PortalNavCard
            href={`/business/dashboard/${businessId}/team`}
            title="Team"
            description="Owners and managers with portal access"
            icon={<Users className="size-4" />}
          />
          <PortalNavCard
            href={`/business/dashboard/${businessId}/settings`}
            title="Settings"
            description="Membership and portal preferences"
            icon={<Settings className="size-4" />}
          />
        </div>
      </PortalSection>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle>Public presence</CardTitle>
          {business.rating != null ? (
            <span className="flex items-center gap-1 text-sm">
              <Star className="size-3.5 fill-amber-400 text-amber-400" />
              {business.rating.toFixed(1)}
            </span>
          ) : null}
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/${business.city_slug}`}>Open Ask Ballito</Link>
          </Button>
          {website ? (
            <Button asChild variant="outline" size="sm">
              <a href={website} target="_blank" rel="noreferrer">
                Website <ExternalLink className="size-3.5" />
              </a>
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
