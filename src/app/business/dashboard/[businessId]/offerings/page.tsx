import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OfferingsEditor } from "@/components/business-portal/offerings-editor";
import {
  loadPortalBusiness,
  requirePortalBusiness,
} from "@/lib/business-portal/load-portal-business";
import { businessMenuItemService } from "@/services/business-portal/business-menu-item.service";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ businessId: string }>;
}): Promise<Metadata> {
  const { businessId } = await params;
  const business = await loadPortalBusiness(businessId);
  return {
    title: business ? `Offerings · ${business.name}` : "Offerings",
  };
}

export default async function BusinessOfferingsPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const { business } = await requirePortalBusiness(businessId);
  const menuItems = await businessMenuItemService.list(businessId);

  const directoryServices = Array.isArray(business.metadata.services)
    ? business.metadata.services.filter(
        (s): s is string => typeof s === "string" && s.trim().length > 0,
      )
    : [];

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Offerings</h1>
        <p className="text-muted-foreground">
          Services, keywords, and menu options for {business.name}. These feed
          Ask Ballito search matching.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>What you offer</CardTitle>
        </CardHeader>
        <CardContent>
          <OfferingsEditor
            businessId={businessId}
            services={business.profile?.services ?? []}
            keywords={business.profile?.keywords ?? []}
            menuItems={menuItems}
            directoryServices={directoryServices}
          />
        </CardContent>
      </Card>
    </div>
  );
}
