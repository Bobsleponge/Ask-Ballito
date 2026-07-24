import type { Metadata } from "next";
import Image from "next/image";
import { BrandingUploadCard } from "@/components/business-portal/branding-upload-card";
import { GalleryManager } from "@/components/business-portal/gallery-manager";
import { PortalSection } from "@/components/business-portal/portal-ui";
import {
  loadPortalBusiness,
  requirePortalBusiness,
} from "@/lib/business-portal/load-portal-business";
import { businessGalleryService } from "@/services/business-portal/business-gallery.service";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ businessId: string }>;
}): Promise<Metadata> {
  const { businessId } = await params;
  const business = await loadPortalBusiness(businessId);
  return {
    title: business ? `Branding · ${business.name}` : "Branding",
  };
}

export default async function BusinessBrandingPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const { business } = await requirePortalBusiness(businessId);
  const gallery = await businessGalleryService.list(businessId);

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Branding</h1>
        <p className="text-muted-foreground">
          Logo, hero, and gallery for {business.name}. Owner images appear on
          Ask Ballito cards ahead of Google photos.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <BrandingUploadCard
          businessId={businessId}
          kind="logo"
          title="Logo"
          hint="Square works best (shown as a badge on cards)."
          currentUrl={business.logoUrl}
          aspectClass="aspect-square max-w-xs"
        />
        <BrandingUploadCard
          businessId={businessId}
          kind="hero"
          title="Hero image"
          hint="Wide landscape image for the card cover and portal header."
          currentUrl={business.heroUrl}
          aspectClass="aspect-[16/9]"
        />
      </div>

      <PortalSection
        title="Your gallery"
        description="Extra photos you control — shown after the hero on public cards."
      >
        <GalleryManager businessId={businessId} images={gallery} />
      </PortalSection>

      <PortalSection
        title="Directory photos"
        description="Synced from Google Places — read-only fallback."
      >
        {business.photos.length === 0 ? (
          <p className="text-sm text-muted-foreground">No directory photos.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {business.photos.map((photo, index) => (
              <div
                key={`${photo.url}-${index}`}
                className="relative aspect-[4/3] overflow-hidden rounded-xl border bg-muted"
              >
                <Image
                  src={photo.url}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="320px"
                />
              </div>
            ))}
          </div>
        )}
      </PortalSection>
    </div>
  );
}
