import Link from "next/link";
import { BusinessCard } from "@/components/concierge/business-card";
import type { VerticalDirectorySection } from "@/services/directory/vertical-directory.service";
import type { City } from "@/config/cities";

export function VerticalDirectory({
  city,
  sections,
}: {
  city: City;
  sections: VerticalDirectorySection[];
}) {
  const filled = sections.filter((s) => s.businesses.length > 0);
  const empty = sections.filter((s) => s.businesses.length === 0);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:py-10">
      <div className="mb-8 max-w-2xl">
        <p className="text-sm font-medium text-muted-foreground">Directory</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
          Explore {city.name}
        </h1>
        <p className="mt-2 text-muted-foreground">
          Top businesses by industry, pulled from Google Places. Ask the{" "}
          <Link href={`/${city.slug}`} className="font-medium text-primary hover:underline">
            concierge
          </Link>{" "}
          for tailored recommendations.
        </p>
      </div>

      {filled.length === 0 ? (
        <div className="rounded-lg border border-dashed px-6 py-12 text-center">
          <p className="font-medium">No Google Places data loaded yet</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Run{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
              npm run ingest -- {city.slug}
            </code>{" "}
            with a configured <code className="rounded bg-muted px-1.5 py-0.5 text-xs">GOOGLE_PLACES_API_KEY</code>.
          </p>
        </div>
      ) : (
        <>
          <nav
            aria-label="Industries"
            className="mb-10 flex flex-wrap gap-2 border-b pb-4"
          >
            {filled.map(({ vertical }) => (
              <a
                key={vertical.slug}
                href={`#${vertical.slug}`}
                className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {vertical.label}
              </a>
            ))}
          </nav>

          <div className="flex flex-col gap-14">
            {filled.map(({ vertical, businesses }) => (
              <section
                key={vertical.slug}
                id={vertical.slug}
                className="scroll-mt-20"
              >
                <div className="mb-4">
                  <h2 className="text-xl font-semibold tracking-tight">
                    {vertical.label}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {vertical.description} · Top {businesses.length}
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {businesses.map((business, index) => (
                    <BusinessCard
                      key={business.id}
                      business={business}
                      index={index}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>

          {empty.length > 0 ? (
            <p className="mt-12 text-sm text-muted-foreground">
              No listings yet for:{" "}
              {empty.map((s) => s.vertical.label).join(", ")}.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
