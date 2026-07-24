import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getCity, getEnabledCities } from "@/config/cities";
import { getHeaderAuth } from "@/lib/auth/header-auth";
import { CityWorkspace } from "@/components/city-workspace";

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
  if (!city) return { title: "City not found" };
  return {
    title: `${city.name}`,
    description: `Your AI concierge for ${city.name}, ${city.region}.`,
  };
}

export default async function CityPage({
  params,
}: {
  params: Promise<{ city: string }>;
}) {
  const { city: slug } = await params;
  const city = getCity(slug);
  if (!city || !city.enabled) notFound();

  const { user, isAdmin, hasBusiness } = await getHeaderAuth();

  return (
    <Suspense fallback={null}>
      <CityWorkspace
        city={city}
        user={user}
        isAdmin={isAdmin}
        hasBusiness={hasBusiness}
      />
    </Suspense>
  );
}
