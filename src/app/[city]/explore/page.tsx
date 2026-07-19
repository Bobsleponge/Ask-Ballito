import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCity, getEnabledCities } from "@/config/cities";
import { getCurrentUser } from "@/lib/auth/user";
import { SiteHeader } from "@/components/site-header";
import { VerticalDirectory } from "@/components/directory/vertical-directory";
import { getVerticalDirectory } from "@/services/directory/vertical-directory.service";
import type { SessionUser } from "@/components/user-menu";

/** Directory data is ingest-driven; refresh periodically after Google pulls. */
export const revalidate = 300;

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

  const [user, sections] = await Promise.all([
    getCurrentUser(),
    getVerticalDirectory(city.slug),
  ]);

  const sessionUser: SessionUser | null = user
    ? {
        id: user.id,
        email: user.email ?? null,
        name:
          (user.user_metadata?.full_name as string | undefined) ??
          (user.user_metadata?.name as string | undefined) ??
          null,
        avatarUrl: (user.user_metadata?.avatar_url as string | undefined) ?? null,
      }
    : null;

  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <SiteHeader city={city} user={sessionUser} />
      <main className="flex flex-1 flex-col">
        <VerticalDirectory city={city} sections={sections} />
      </main>
    </div>
  );
}
