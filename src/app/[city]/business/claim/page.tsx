import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCity, getEnabledCities } from "@/config/cities";
import { getHeaderAuth } from "@/lib/auth/header-auth";
import { SiteHeader } from "@/components/site-header";
import { ClaimWizard } from "@/components/business-portal/claim-wizard";

export function generateStaticParams() {
  return getEnabledCities().map((c) => ({ city: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string }>;
}): Promise<Metadata> {
  const { city: slug } = await params;
  const city = getCity(slug);
  if (!city) return { title: "Claim your business" };
  return {
    title: `Claim your business in ${city.name}`,
    description: `Search and claim your business listing in ${city.name}.`,
  };
}

export default async function BusinessClaimPage({
  params,
}: {
  params: Promise<{ city: string }>;
}) {
  const { city: slug } = await params;
  const city = getCity(slug);
  if (!city || !city.enabled) notFound();

  const { user, isAdmin, hasBusiness } = await getHeaderAuth();

  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <SiteHeader
        city={city}
        user={user}
        isAdmin={isAdmin}
        hasBusiness={hasBusiness}
      />
      <main className="flex flex-1 flex-col">
        <ClaimWizard
          citySlug={city.slug}
          cityName={city.name}
          user={user}
        />
      </main>
    </div>
  );
}
