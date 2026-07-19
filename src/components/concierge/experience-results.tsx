"use client";

import type { BusinessResult } from "@/lib/schemas/business";
import type { CompositionPayload } from "@/services/composition/types";
import { BusinessCard } from "./business-card";
import { cn } from "@/lib/utils";

interface ExperienceResultsProps {
  businesses: BusinessResult[];
  composition?: CompositionPayload | null;
  className?: string;
}

function CardGrid({
  businesses,
  startIndex = 0,
}: {
  businesses: BusinessResult[];
  startIndex?: number;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {businesses.map((b, i) => (
        <BusinessCard key={b.id} business={b} index={startIndex + i} />
      ))}
    </div>
  );
}

export function ExperienceResults({
  businesses,
  composition,
  className,
}: ExperienceResultsProps) {
  if (!businesses.length) return null;

  const byId = new Map(businesses.map((b) => [b.id, b]));

  if (!composition || composition.sections.length === 0) {
    return (
      <div className={cn(className)}>
        <CardGrid businesses={businesses} />
      </div>
    );
  }

  const isCompare = composition.strategy === "comparison";
  const isItinerary = composition.strategy === "itinerary";

  if (isCompare) {
    return (
      <div className={cn("flex flex-col gap-4", className)}>
        {composition.title ? (
          <h3 className="text-sm font-medium text-foreground">
            {composition.title}
          </h3>
        ) : null}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {composition.sections.map((section) => {
            const items = section.businessIds
              .map((id) => byId.get(id))
              .filter((b): b is BusinessResult => Boolean(b));
            if (items.length === 0) return null;
            return (
              <div key={section.id} className="flex flex-col gap-2">
                <div>
                  <p className="text-sm font-medium">{section.title}</p>
                  {section.subtitle ? (
                    <p className="text-xs text-muted-foreground">
                      {section.subtitle}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-col gap-3">
                  {items.map((b, i) => (
                    <BusinessCard key={b.id} business={b} index={i} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      {composition.title ? (
        <h3 className="text-sm font-medium text-foreground">
          {composition.title}
        </h3>
      ) : null}
      {composition.sections.map((section, sectionIndex) => {
        const items = section.businessIds
          .map((id) => byId.get(id))
          .filter((b): b is BusinessResult => Boolean(b));
        if (items.length === 0) return null;
        return (
          <section key={section.id} className="flex flex-col gap-2">
            <div className="flex items-baseline gap-2">
              {isItinerary ? (
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                  {sectionIndex + 1}
                </span>
              ) : null}
              <div>
                <h4 className="text-sm font-medium">{section.title}</h4>
                {section.subtitle ? (
                  <p className="text-xs text-muted-foreground">
                    {section.subtitle}
                  </p>
                ) : null}
              </div>
            </div>
            <CardGrid businesses={items} />
          </section>
        );
      })}
    </div>
  );
}
