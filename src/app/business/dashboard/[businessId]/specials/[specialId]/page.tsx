import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SpecialForm } from "@/components/business-portal/special-form";
import {
  loadPortalBusiness,
  requirePortalBusiness,
} from "@/lib/business-portal/load-portal-business";
import { businessSpecialService } from "@/services/business-portal/business-special.service";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ businessId: string; specialId: string }>;
}): Promise<Metadata> {
  const { businessId } = await params;
  const business = await loadPortalBusiness(businessId);
  return {
    title: business ? `Edit special · ${business.name}` : "Edit special",
  };
}

export default async function EditSpecialPage({
  params,
}: {
  params: Promise<{ businessId: string; specialId: string }>;
}) {
  const { businessId, specialId } = await params;
  await requirePortalBusiness(businessId);
  const special = await businessSpecialService.get(specialId);
  if (!special || special.business_id !== businessId) notFound();

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Edit special</h1>
        <p className="text-muted-foreground">{special.title}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          <SpecialForm
            businessId={businessId}
            mode="edit"
            initial={{
              id: special.id,
              title: special.title,
              description: special.description,
              status: special.status,
              kind: special.kind,
              discount_label: special.discount_label,
              terms: special.terms,
              cta_url: special.cta_url,
              schedule_type: special.schedule_type,
              starts_at: special.starts_at,
              ends_at: special.ends_at,
              valid_from: special.valid_from,
              valid_until: special.valid_until,
              recurrence: special.recurrence,
              image_path: special.image_path,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
