import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCity, getEnabledCities } from "@/config/cities";
import { getHeaderAuth } from "@/lib/auth/header-auth";
import { SiteHeader } from "@/components/site-header";
import { VerticalDirectory } from "@/components/directory/vertical-directory";
import { getVerticalDirectory } from "@/services/directory/vertical-directory.service";

/** Directory data is ingest-driven; refresh periodically after Google pulls. */
export const revalidate = 600;

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
    title: `Explore ${city.name}`,
    description: `Browse top businesses by industry in ${city.name}, sourced from Google Places.`,
  };
}

export default async function ExplorePage({
  params,
}: {
  params: Promise<{ city: string }>;
}) {
  const { city: slug } = await params;
  const city = getCity(slug);
  if (!city || !city.enabled) notFound();

  const [{ user, isAdmin, hasBusiness }, sections] = await Promise.all([
    getHeaderAuth(),
    getVerticalDirectory(city.slug),
  ]);

  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <SiteHeader
        city={city}
        user={user}
        isAdmin={isAdmin}
        hasBusiness={hasBusiness}
      />
      <main className="flex flex-1 flex-col">
        <VerticalDirectory city={city} sections={sections} />
      </main>
    </div>
  );
}
