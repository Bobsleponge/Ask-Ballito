import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SpecialActions } from "@/components/business-portal/special-actions";
import { PortalEmpty } from "@/components/business-portal/portal-ui";
import {
  loadPortalBusiness,
  requirePortalBusiness,
} from "@/lib/business-portal/load-portal-business";
import {
  isSpecialLive,
  isSpecialUpcoming,
  parseRecurrence,
} from "@/lib/business-portal/special-live";
import { publicMediaUrl } from "@/services/business-portal/business-media.service";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ businessId: string }>;
}): Promise<Metadata> {
  const { businessId } = await params;
  const business = await loadPortalBusiness(businessId);
  return {
    title: business ? `Specials · ${business.name}` : "Specials",
  };
}

export default async function BusinessSpecialsPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<{ filter?: string }>;
}) {
  const { businessId } = await params;
  const { filter = "all" } = await searchParams;
  const { business } = await requirePortalBusiness(businessId);
  const now = new Date();

  const filtered = business.specials.filter((s) => {
    if (filter === "live") return isSpecialLive(s, now);
    if (filter === "upcoming") return isSpecialUpcoming(s, now);
    if (filter === "archived") return s.status === "archived";
    return true;
  });

  const filters = [
    { id: "all", label: "All" },
    { id: "live", label: "Live now" },
    { id: "upcoming", label: "Upcoming" },
    { id: "archived", label: "Archived" },
  ] as const;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Specials</h1>
          <p className="text-muted-foreground">
            One-time and recurring promotions for {business.name}.
          </p>
        </div>
        <Button asChild>
          <Link href={`/business/dashboard/${businessId}/specials/new`}>
            Add special
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <Button
            key={f.id}
            asChild
            size="sm"
            variant={filter === f.id ? "default" : "outline"}
          >
            <Link href={`?filter=${f.id}`}>{f.label}</Link>
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <PortalEmpty
          title="No specials in this view"
          description="Create a lunch deal, happy hour, or limited-time promo."
          action={
            <Button asChild>
              <Link href={`/business/dashboard/${businessId}/specials/new`}>
                Create special
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((special) => {
            const imageUrl = publicMediaUrl(special.image_path);
            const live = isSpecialLive(special, now);
            const recurrence = parseRecurrence(special.recurrence);
            return (
              <Card key={special.id}>
                <CardContent className="flex flex-wrap items-center gap-4 py-4">
                  <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                    {imageUrl ? (
                      <Image
                        src={imageUrl}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="64px"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{special.title}</p>
                      <Badge variant="outline" className="capitalize">
                        {special.kind.replace("_", " ")}
                      </Badge>
                      <Badge
                        variant={
                          live
                            ? "default"
                            : special.status === "archived"
                              ? "outline"
                              : "secondary"
                        }
                        className="capitalize"
                      >
                        {live ? "Live" : special.status}
                      </Badge>
                      {special.discount_label ? (
                        <Badge variant="secondary">
                          {special.discount_label}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {special.schedule_type === "recurring" && recurrence
                        ? `Weekly · ${recurrence.daysOfWeek
                            .map(
                              (d) =>
                                ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
                                  d
                                ],
                            )
                            .join(", ")} · ${recurrence.startTime}–${recurrence.endTime}`
                        : "One-time window"}
                    </p>
                    {special.description ? (
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {special.description}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link
                        href={`/business/dashboard/${businessId}/specials/${special.id}`}
                      >
                        Edit
                      </Link>
                    </Button>
                    <SpecialActions
                      businessId={businessId}
                      specialId={special.id}
                      status={special.status}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
