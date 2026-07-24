import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCity, getEnabledCities } from "@/config/cities";
import { siteConfig } from "@/config/site";
import { getHeaderAuth } from "@/lib/auth/header-auth";
import { SiteHeader } from "@/components/site-header";
import { AboutPage } from "@/components/about/about-page";

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
    title: `About ${siteConfig.name}`,
    description: siteConfig.description,
  };
}

export default async function AboutRoutePage({
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
        <AboutPage city={city} />
      </main>
    </div>
  );
}
