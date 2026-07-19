"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Star, MapPin, Globe, Phone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { analytics } from "@/lib/analytics/events";
import type { BusinessResult } from "@/lib/schemas/business";

function priceLabel(level: number | null): string | null {
  if (level == null) return null;
  return "R".repeat(Math.max(1, level));
}

function serviceChips(
  metadata: Record<string, unknown> | undefined,
  max = 3,
): string[] {
  const raw = metadata?.services;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    .slice(0, max);
}

export function BusinessCard({
  business,
  index = 0,
  variant = "default",
}: {
  business: BusinessResult;
  index?: number;
  variant?: "default" | "compact";
}) {
  const photo = business.photos?.[0];
  const price = priceLabel(business.priceLevel);
  const compact = variant === "compact";
  const services = serviceChips(business.metadata, compact ? 2 : 3);
  const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${business.name} ${business.address ?? ""}`,
  )}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.04 }}
      onViewportEnter={() =>
        analytics.capture("business_viewed", { id: business.id })
      }
    >
      <Card
        className={
          compact
            ? "overflow-hidden border-border/70 py-0 gap-0 shadow-sm"
            : "overflow-hidden py-0 gap-0"
        }
      >
        {photo ? (
          <div
            className={
              compact
                ? "relative h-28 w-full bg-muted"
                : "relative h-36 w-full bg-muted"
            }
          >
            <Image
              src={photo.url}
              alt={business.name}
              fill
              sizes="(max-width: 768px) 100vw, 360px"
              className="object-cover"
            />
          </div>
        ) : null}
        <CardContent
          className={
            compact
              ? "flex flex-col gap-1.5 p-3"
              : "flex flex-col gap-2 p-4"
          }
        >
          <div className="flex items-start justify-between gap-2">
            <h3
              className={
                compact
                  ? "text-sm font-semibold leading-tight"
                  : "font-semibold leading-tight"
              }
            >
              {business.name}
            </h3>
            {business.rating != null ? (
              <span className="flex shrink-0 items-center gap-1 text-sm">
                <Star className="size-3.5 fill-amber-400 text-amber-400" />
                {business.rating.toFixed(1)}
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {business.category ? (
              <Badge variant="secondary">{business.category}</Badge>
            ) : null}
            {price ? <Badge variant="outline">{price}</Badge> : null}
            {services.map((service) => (
              <Badge key={service} variant="outline" className="font-normal">
                {service}
              </Badge>
            ))}
          </div>

          {!compact && business.description ? (
            <p className="line-clamp-2 text-sm text-muted-foreground">
              {business.description}
            </p>
          ) : null}

          <div className="mt-0.5 flex flex-col gap-1 text-sm text-muted-foreground">
            {business.address ? (
              <span className="flex items-center gap-1.5">
                <MapPin className="size-3.5 shrink-0" />
                <span className="line-clamp-1">{business.address}</span>
              </span>
            ) : null}
          </div>

          <div className="mt-1.5 flex flex-wrap gap-3 text-sm">
            <a
              href={maps}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
              onClick={() =>
                analytics.capture("business_clicked", {
                  id: business.id,
                  target: "maps",
                })
              }
            >
              <MapPin className="size-3.5" /> Directions
            </a>
            {business.website ? (
              <a
                href={business.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                onClick={() =>
                  analytics.capture("business_clicked", {
                    id: business.id,
                    target: "website",
                  })
                }
              >
                <Globe className="size-3.5" /> Website
              </a>
            ) : null}
            {business.phone ? (
              <a
                href={`tel:${business.phone}`}
                className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
              >
                <Phone className="size-3.5" /> Call
              </a>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
