import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListingEditForm } from "@/components/business-portal/listing-edit-form";
import {
  loadPortalBusiness,
  requirePortalBusiness,
} from "@/lib/business-portal/load-portal-business";
import { extractAttributes } from "@/lib/schemas/business-attributes";
import type { HoursOverride } from "@/lib/schemas/business-profile";
import type { Json } from "@/types/database";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ businessId: string }>;
}): Promise<Metadata> {
  const { businessId } = await params;
  const business = await loadPortalBusiness(businessId);
  return {
    title: business ? `Listing · ${business.name}` : "Listing",
  };
}

export default async function BusinessListingPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const { business } = await requirePortalBusiness(businessId);

  const hoursOverride = parseHours(business.profile?.hours_override);
  const attributes = extractAttributes({
    attributes: business.profile?.attributes ?? {},
  });
  const businessVerticals = verticalsFromMetadata(business.metadata);

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Listing</h1>
        <p className="text-muted-foreground">
          Edit how {business.name} appears on Ask Ballito. Overrides sit on top
          of the Google directory listing.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Listing details</CardTitle>
        </CardHeader>
        <CardContent>
          <ListingEditForm
            businessId={businessId}
            tagline={business.profile?.tagline ?? ""}
            description={business.profile?.description ?? ""}
            phone={business.profile?.phone ?? ""}
            website={business.profile?.website ?? ""}
            hoursOverride={hoursOverride}
            attributes={attributes}
            listingVertical={business.profile?.listing_vertical ?? null}
            businessVerticals={businessVerticals}
            directoryDescription={business.directoryDescription ?? ""}
            directoryPhone={business.directoryPhone ?? ""}
            directoryWebsite={business.directoryWebsite ?? ""}
            directoryName={business.name}
            directoryAddress={business.address ?? ""}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function parseHours(raw: Json | null | undefined): HoursOverride | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as HoursOverride;
}

function verticalsFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
): string[] {
  if (!metadata || typeof metadata !== "object") return [];
  const raw = metadata.verticals;
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === "string" && v.length > 0);
}
