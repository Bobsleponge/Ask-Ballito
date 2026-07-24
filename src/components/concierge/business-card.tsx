"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Star, MapPin, Globe, Phone, ChevronRight } from "lucide-react";
import { analytics } from "@/lib/analytics/events";
import { safeHttpUrl } from "@/lib/security/safe-url";
import { cn } from "@/lib/utils";
import type { BusinessResult } from "@/lib/schemas/business";

function priceLabel(level: number | null): string | null {
  if (level == null) return null;
  return "R".repeat(Math.max(1, level));
}

function serviceChips(
  metadata: Record<string, unknown> | undefined,
  max = 2,
): string[] {
  const raw = metadata?.services;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    .slice(0, max);
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

function ActionLink({
  href,
  label,
  icon: Icon,
  onClick,
  emphasize,
}: {
  href: string;
  label: string;
  icon: typeof Phone;
  onClick?: () => void;
  emphasize?: boolean;
}) {
  return (
    <a
      href={href}
      target={href.startsWith("tel:") ? undefined : "_blank"}
      rel={href.startsWith("tel:") ? undefined : "noopener noreferrer"}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium transition-colors",
        emphasize
          ? "bg-primary text-primary-foreground hover:bg-primary/90"
          : "bg-secondary/80 text-secondary-foreground hover:bg-accent hover:text-accent-foreground",
      )}
    >
      <Icon className="size-3.5 shrink-0 opacity-90" />
      {label}
    </a>
  );
}

export function BusinessCard({
  business,
  index = 0,
  variant = "default",
  onSelect,
}: {
  business: BusinessResult;
  index?: number;
  variant?: "default" | "compact";
  /** Opens the in-app listing (chat detail sheet or explore deep link). */
  onSelect?: (business: BusinessResult) => void;
}) {
  const photo = business.heroUrl
    ? { url: business.heroUrl }
    : business.photos?.[0];
  const price = priceLabel(business.priceLevel);
  const compact = variant === "compact";
  const services = serviceChips(business.metadata, compact ? 1 : 2);
  const website = safeHttpUrl(business.website);
  const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${business.name} ${business.address ?? ""}`,
  )}`;
  const specialTitle = business.activeSpecials?.[0]?.title;
  const selectable = typeof onSelect === "function";
  const ratingCount = business.ratingCount;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: Math.min(index, 8) * 0.04 }}
      onViewportEnter={() =>
        analytics.capture("business_viewed", { id: business.id })
      }
      className="h-full"
    >
      <article
        role={selectable ? "button" : undefined}
        tabIndex={selectable ? 0 : undefined}
        onClick={
          selectable
            ? () => {
                analytics.capture("business_clicked", {
                  id: business.id,
                  target: "detail",
                });
                onSelect(business);
              }
            : undefined
        }
        onKeyDown={
          selectable
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(business);
                }
              }
            : undefined
        }
        className={cn(
          "group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border/50 bg-card shadow-coastal",
          "ring-1 ring-ocean/5",
          selectable &&
            "cursor-pointer transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-coastal-lg hover:ring-aqua/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        <div
          className={cn(
            "relative w-full overflow-hidden bg-muted",
            compact ? "aspect-[16/10]" : "aspect-[16/9]",
          )}
        >
          {photo ? (
            <Image
              src={photo.url}
              alt={business.name}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 320px"
              className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center bg-gradient-to-br from-ocean/90 via-primary to-aqua/70"
              aria-hidden
            >
              <span className="font-heading text-3xl font-semibold tracking-tight text-primary-foreground/90">
                {initials(business.name)}
              </span>
            </div>
          )}

          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ocean/35 via-transparent to-transparent opacity-80" />

          {business.rating != null ? (
            <div className="absolute top-2.5 right-2.5 flex items-center gap-1 rounded-full bg-card/95 px-2 py-1 text-xs font-semibold text-foreground shadow-sm backdrop-blur-sm">
              <Star className="size-3 fill-amber-400 text-amber-400" />
              <span>{business.rating.toFixed(1)}</span>
              {ratingCount != null && ratingCount > 0 ? (
                <span className="font-normal text-muted-foreground">
                  ({ratingCount > 999 ? `${Math.round(ratingCount / 100) / 10}k` : ratingCount})
                </span>
              ) : null}
            </div>
          ) : null}

          {specialTitle ? (
            <div className="absolute top-2.5 left-2.5 max-w-[70%] truncate rounded-full bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground shadow-sm">
              {specialTitle}
            </div>
          ) : null}

          {business.logoUrl ? (
            <div className="absolute bottom-2.5 left-2.5 size-11 overflow-hidden rounded-xl border-2 border-card bg-card shadow-md sm:size-12">
              <Image
                src={business.logoUrl}
                alt=""
                fill
                className="object-cover"
                sizes="48px"
              />
            </div>
          ) : null}
        </div>

        <div
          className={cn(
            "flex flex-1 flex-col",
            compact ? "gap-2 p-3.5" : "gap-2.5 p-4",
          )}
        >
          <div className="min-w-0 space-y-1">
            <h3
              className={cn(
                "font-heading font-semibold tracking-tight text-foreground",
                compact ? "text-[15px] leading-snug" : "text-base leading-snug",
              )}
            >
              <span className="line-clamp-2">{business.name}</span>
            </h3>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
              {business.category ? (
                <span className="line-clamp-1 font-medium text-foreground/70">
                  {business.category}
                </span>
              ) : null}
              {price ? (
                <>
                  {business.category ? (
                    <span className="text-border" aria-hidden>
                      ·
                    </span>
                  ) : null}
                  <span className="tabular-nums tracking-wide">{price}</span>
                </>
              ) : null}
            </div>
          </div>

          {!compact && business.description ? (
            <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
              {business.description}
            </p>
          ) : null}

          {services.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {services.map((service) => (
                <span
                  key={service}
                  className="inline-flex max-w-full truncate rounded-md bg-sand/80 px-2 py-0.5 text-[11px] font-medium text-foreground/75"
                >
                  {service}
                </span>
              ))}
            </div>
          ) : null}

          {business.address ? (
            <p className="flex items-start gap-1.5 text-xs leading-snug text-muted-foreground">
              <MapPin className="mt-0.5 size-3.5 shrink-0 text-aqua" />
              <span className="line-clamp-1">{business.address}</span>
            </p>
          ) : null}

          <div
            className="mt-auto flex flex-wrap items-center gap-1.5 pt-1"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {business.phone ? (
              <ActionLink
                href={`tel:${business.phone}`}
                label="Call"
                icon={Phone}
                emphasize
                onClick={() =>
                  analytics.capture("business_clicked", {
                    id: business.id,
                    target: "phone",
                  })
                }
              />
            ) : null}
            <ActionLink
              href={maps}
              label="Map"
              icon={MapPin}
              onClick={() =>
                analytics.capture("business_clicked", {
                  id: business.id,
                  target: "maps",
                })
              }
            />
            {website ? (
              <ActionLink
                href={website}
                label="Site"
                icon={Globe}
                onClick={() =>
                  analytics.capture("business_clicked", {
                    id: business.id,
                    target: "website",
                  })
                }
              />
            ) : null}
            {selectable ? (
              <span className="ml-auto inline-flex items-center gap-0.5 text-xs font-medium text-muted-foreground transition-colors group-hover:text-primary">
                Details
                <ChevronRight className="size-3.5" />
              </span>
            ) : null}
          </div>
        </div>
      </article>
    </motion.div>
  );
}
