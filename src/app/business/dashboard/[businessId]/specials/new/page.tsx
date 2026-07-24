import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SpecialForm } from "@/components/business-portal/special-form";
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
    title: business ? `New special · ${business.name}` : "New special",
  };
}

export default async function NewSpecialPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  await requirePortalBusiness(businessId);

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">New special</h1>
        <p className="text-muted-foreground">
          Create a promotion visitors can discover on Ask Ballito.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          <SpecialForm businessId={businessId} mode="create" />
        </CardContent>
      </Card>
    </div>
  );
}
