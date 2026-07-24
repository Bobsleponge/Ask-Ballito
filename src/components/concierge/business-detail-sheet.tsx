"use client";

import Image from "next/image";
import {
  Star,
  MapPin,
  Globe,
  Phone,
  Clock,
  Tag,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { analytics } from "@/lib/analytics/events";
import { safeHttpUrl } from "@/lib/security/safe-url";
import { extractAttributes } from "@/lib/schemas/business-attributes";
import { attributeDisplayLabel } from "@/config/vertical-listing-fields";
import type { BusinessResult } from "@/lib/schemas/business";

function priceLabel(level: number | null): string | null {
  if (level == null) return null;
  return "R".repeat(Math.max(1, level));
}

function serviceList(metadata: Record<string, unknown> | undefined): string[] {
  const raw = metadata?.services;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (s): s is string => typeof s === "string" && s.trim().length > 0,
  );
}

function hoursList(metadata: Record<string, unknown> | undefined): string[] {
  const hours = metadata?.openingHours;
  if (!hours || typeof hours !== "object") return [];
  const days = (hours as { weekdayDescriptions?: unknown }).weekdayDescriptions;
  if (!Array.isArray(days)) return [];
  return days.filter((d): d is string => typeof d === "string");
}

function amenityLabelsFromAttrs(
  attrs: ReturnType<typeof extractAttributes>,
): string[] {
  const labels: string[] = [];
  for (const [key, value] of Object.entries(attrs)) {
    if (value === true) {
      labels.push(attributeDisplayLabel(key));
    } else if (key === "noiseLevel" && typeof value === "string" && value) {
      labels.push(
        `Noise: ${value.charAt(0).toUpperCase()}${value.slice(1)}`,
      );
    }
  }
  return labels;
}

export function BusinessDetailSheet({
  business,
  open,
  onOpenChange,
}: {
  business: BusinessResult | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!business) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full gap-0 sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Business</SheetTitle>
            <SheetDescription>Loading…</SheetDescription>
          </SheetHeader>
        </SheetContent>
      </Sheet>
    );
  }

  const website = safeHttpUrl(business.website);
  const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${business.name} ${business.address ?? ""}`,
  )}`;
  const price = priceLabel(business.priceLevel);
  const services = serviceList(business.metadata);
  const hours = hoursList(business.metadata);
  const attrs = extractAttributes(business.metadata);
  const amenityLabels = amenityLabelsFromAttrs(attrs);
  const tagline =
    typeof business.metadata?.tagline === "string"
      ? business.metadata.tagline
      : null;
  const menuItems = business.menuItems ?? [];
  const specials = business.activeSpecials ?? [];
  const gallery = business.photos ?? [];
  const hero = business.heroUrl ?? gallery[0]?.url ?? null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>{business.name}</SheetTitle>
          <SheetDescription>
            Listing details for {business.name}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="pb-28">
            <div className="relative h-48 w-full bg-muted">
              {hero ? (
                <Image
                  src={hero}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="420px"
                  priority
                />
              ) : null}
              {business.logoUrl ? (
                <div className="absolute bottom-3 left-3 size-14 overflow-hidden rounded-xl border-2 border-white bg-white shadow">
                  <Image
                    src={business.logoUrl}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="56px"
                  />
                </div>
              ) : null}
            </div>

            <div className="space-y-5 px-4 pt-4">
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-xl font-semibold leading-tight">
                    {business.name}
                  </h2>
                  {business.rating != null ? (
                    <span className="flex shrink-0 items-center gap-1 text-sm">
                      <Star className="size-3.5 fill-amber-400 text-amber-400" />
                      {business.rating.toFixed(1)}
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {business.category ? (
                    <Badge variant="secondary">{business.category}</Badge>
                  ) : null}
                  {price ? <Badge variant="outline">{price}</Badge> : null}
                </div>
                {tagline ? (
                  <p className="text-sm font-medium text-teal-800 dark:text-teal-300">
                    {tagline}
                  </p>
                ) : null}
                {business.description ? (
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {business.description}
                  </p>
                ) : null}
                {business.address ? (
                  <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="mt-0.5 size-3.5 shrink-0" />
                    {business.address}
                  </p>
                ) : null}
              </div>

              {specials.length > 0 ? (
                <section className="space-y-2">
                  <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                    <Tag className="size-3.5" />
                    Specials
                  </h3>
                  <div className="space-y-2">
                    {specials.map((s) => (
                      <div
                        key={s.id}
                        className="rounded-lg border border-teal-200 bg-teal-50/80 p-3 dark:border-teal-900 dark:bg-teal-950/40"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{s.title}</p>
                          {s.discountLabel ? (
                            <Badge className="bg-teal-700 text-white">
                              {s.discountLabel}
                            </Badge>
                          ) : null}
                          {s.kind ? (
                            <Badge variant="outline" className="capitalize">
                              {s.kind.replace("_", " ")}
                            </Badge>
                          ) : null}
                        </div>
                        {s.terms ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {s.terms}
                          </p>
                        ) : null}
                        {s.ctaUrl && safeHttpUrl(s.ctaUrl) ? (
                          <a
                            href={safeHttpUrl(s.ctaUrl)!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 inline-block text-sm font-medium text-teal-800 underline-offset-2 hover:underline"
                          >
                            Book / claim offer
                          </a>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {hours.length > 0 ? (
                <section className="space-y-2">
                  <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                    <Clock className="size-3.5" />
                    Hours
                  </h3>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {hours.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {amenityLabels.length > 0 ? (
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold">Amenities</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {amenityLabels.map((label) => (
                      <Badge key={label} variant="secondary" className="font-normal">
                        {label}
                      </Badge>
                    ))}
                  </div>
                </section>
              ) : null}

              {services.length > 0 ? (
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold">Services</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {services.slice(0, 24).map((s) => (
                      <Badge key={s} variant="outline" className="font-normal">
                        {s}
                      </Badge>
                    ))}
                  </div>
                </section>
              ) : null}

              {menuItems.length > 0 ? (
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold">Menu / options</h3>
                  <ul className="space-y-2">
                    {menuItems.map((item, i) => (
                      <li
                        key={item.id ?? `${item.name}-${i}`}
                        className="flex gap-3 rounded-lg border p-2"
                      >
                        <div className="relative size-12 shrink-0 overflow-hidden rounded-md bg-muted">
                          {item.imageUrl ? (
                            <Image
                              src={item.imageUrl}
                              alt=""
                              fill
                              className="object-cover"
                              sizes="48px"
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <p className="truncate text-sm font-medium">
                              {item.name}
                            </p>
                            {item.price ? (
                              <span className="shrink-0 text-sm text-muted-foreground">
                                {item.price}
                              </span>
                            ) : null}
                          </div>
                          {item.category ? (
                            <p className="text-xs text-muted-foreground">
                              {item.category}
                            </p>
                          ) : null}
                          {item.description ? (
                            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                              {item.description}
                            </p>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {gallery.length > 1 ? (
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold">Photos</h3>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {gallery.slice(0, 12).map((photo, i) => (
                      <div
                        key={`${photo.url}-${i}`}
                        className="relative h-20 w-28 shrink-0 overflow-hidden rounded-lg bg-muted"
                      >
                        <Image
                          src={photo.url}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="112px"
                        />
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          </div>
        </ScrollArea>

        <div className="absolute inset-x-0 bottom-0 border-t bg-background/95 p-3 backdrop-blur">
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" className="flex-1">
              <a
                href={maps}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() =>
                  analytics.capture("business_clicked", {
                    id: business.id,
                    target: "maps",
                  })
                }
              >
                <MapPin className="size-3.5" />
                Directions
              </a>
            </Button>
            {website ? (
              <Button asChild size="sm" variant="outline" className="flex-1">
                <a
                  href={website}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() =>
                    analytics.capture("business_clicked", {
                      id: business.id,
                      target: "website",
                    })
                  }
                >
                  <Globe className="size-3.5" />
                  Website
                </a>
              </Button>
            ) : null}
            {business.phone ? (
              <Button asChild size="sm" variant="outline" className="flex-1">
                <a href={`tel:${business.phone}`}>
                  <Phone className="size-3.5" />
                  Call
                </a>
              </Button>
            ) : null}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-2 w-full text-muted-foreground"
            onClick={() => onOpenChange(false)}
          >
            Back to chat
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
