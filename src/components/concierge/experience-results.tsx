"use client";

import { useCallback, useState } from "react";
import { Loader2 } from "lucide-react";
import type { BusinessResult } from "@/lib/schemas/business";
import type { CompositionPayload } from "@/services/composition/types";
import { blurbForSection } from "@/lib/chat/parse-recommendation-narration";
import { AssistantProse } from "./assistant-prose";
import { BusinessCard } from "./business-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ExperienceResultsProps {
  businesses: BusinessResult[];
  composition?: CompositionPayload | null;
  className?: string;
  /** Compact cards for in-chat grids; default for results sheet. */
  cardVariant?: "default" | "compact";
  /** LLM blurbs keyed by section title — shown under each section heading. */
  sectionBlurbs?: Record<string, string>;
  /** Ask-relevant phrases to bold in section blurbs. */
  emphasizeTerms?: Array<string | null | undefined>;
  onSelectBusiness?: (business: BusinessResult) => void;
  /**
   * Load more options for a section. Return newly fetched businesses
   * (already merged into the store by the caller).
   */
  onLoadMoreSection?: (section: {
    id: string;
    title: string;
    shownIds: string[];
  }) => Promise<BusinessResult[]>;
  /** Hide load-more while the main chat turn is streaming. */
  loadMoreDisabled?: boolean;
}

function CardGrid({
  businesses,
  startIndex = 0,
  cardVariant = "default",
  onSelect,
}: {
  businesses: BusinessResult[];
  startIndex?: number;
  cardVariant?: "default" | "compact";
  onSelect?: (business: BusinessResult) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
      {businesses.map((b, i) => (
        <BusinessCard
          key={b.id}
          business={b}
          index={startIndex + i}
          variant={cardVariant}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function SectionCopy({
  title,
  subtitle,
  blurb,
  step,
  emphasizeNames,
  emphasizePhones,
  emphasizeTerms,
}: {
  title: string;
  subtitle?: string | null;
  blurb?: string | null;
  step?: number;
  emphasizeNames?: Array<string | null | undefined>;
  emphasizePhones?: Array<string | null | undefined>;
  emphasizeTerms?: Array<string | null | undefined>;
}) {
  return (
    <div className="flex items-start gap-2">
      {step != null ? (
        <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-foreground">
          {step}
        </span>
      ) : null}
      <div className="min-w-0 flex-1 space-y-2">
        <h4 className="font-heading text-base font-semibold tracking-tight text-foreground">
          {title}
        </h4>
        {blurb ? (
          <AssistantProse
            text={blurb}
            className="max-w-[42rem] text-[15px] leading-[1.7] text-foreground"
            emphasizeNames={emphasizeNames}
            emphasizePhones={emphasizePhones}
            emphasizeTerms={emphasizeTerms}
          />
        ) : subtitle ? (
          <p className="text-sm leading-relaxed text-foreground/80">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}

function SectionLoadMore({
  sectionId,
  sectionTitle,
  shownIds,
  disabled,
  onLoadMore,
}: {
  sectionId: string;
  sectionTitle: string;
  shownIds: string[];
  disabled?: boolean;
  onLoadMore: ExperienceResultsProps["onLoadMoreSection"];
}) {
  const [busy, setBusy] = useState(false);
  const [exhausted, setExhausted] = useState(false);

  const handleClick = useCallback(async () => {
    if (!onLoadMore || busy || exhausted || disabled) return;
    setBusy(true);
    try {
      const added = await onLoadMore({
        id: sectionId,
        title: sectionTitle,
        shownIds,
      });
      if (added.length === 0) setExhausted(true);
    } catch {
      // Keep button available for a retry.
    } finally {
      setBusy(false);
    }
  }, [
    onLoadMore,
    busy,
    exhausted,
    disabled,
    sectionId,
    sectionTitle,
    shownIds,
  ]);

  if (!onLoadMore || exhausted) {
    if (exhausted) {
      return (
        <p className="text-xs text-muted-foreground">
          No more options for {sectionTitle.toLowerCase()} right now
        </p>
      );
    }
    return null;
  }

  return (
    <div className="pt-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 gap-2 rounded-lg px-2 text-muted-foreground hover:text-foreground"
        disabled={busy || disabled}
        onClick={() => void handleClick()}
        aria-label={`Load more for ${sectionTitle}`}
      >
        {busy ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : null}
        Load more
      </Button>
    </div>
  );
}

export function ExperienceResults({
  businesses,
  composition,
  className,
  cardVariant = "default",
  sectionBlurbs,
  emphasizeTerms,
  onSelectBusiness,
  onLoadMoreSection,
  loadMoreDisabled,
}: ExperienceResultsProps) {
  if (!businesses.length) return null;

  const byId = new Map(businesses.map((b) => [b.id, b]));
  const blurbs = sectionBlurbs ?? {};
  const emphasizeNames = businesses.map((b) => b.name);
  const emphasizePhones = businesses.map((b) => b.phone);

  if (!composition || composition.sections.length === 0) {
    return (
      <div className={cn(className)}>
        <CardGrid
          businesses={businesses}
          cardVariant={cardVariant}
          onSelect={onSelectBusiness}
        />
        {onLoadMoreSection ? (
          <SectionLoadMore
            sectionId="list"
            sectionTitle="More options"
            shownIds={businesses.map((b) => b.id)}
            disabled={loadMoreDisabled}
            onLoadMore={onLoadMoreSection}
          />
        ) : null}
      </div>
    );
  }

  const isCompare = composition.strategy === "comparison";
  const isItinerary = composition.strategy === "itinerary";
  const singleSection = composition.sections.length === 1;
  const sectionTitleMatchesComposition =
    singleSection &&
    composition.title != null &&
    composition.sections[0]?.title.trim().toLowerCase() ===
      composition.title.trim().toLowerCase();
  const showCompositionTitle =
    Boolean(composition.title) && !sectionTitleMatchesComposition;

  if (isCompare) {
    return (
      <div className={cn("flex flex-col gap-4", className)}>
        {showCompositionTitle ? (
          <h3 className="font-heading text-base font-semibold tracking-tight text-foreground">
            {composition.title}
          </h3>
        ) : null}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {composition.sections.map((section) => {
            const items = section.businessIds
              .map((id) => byId.get(id))
              .filter((b): b is BusinessResult => Boolean(b));
            if (items.length === 0) return null;
            const blurb = blurbForSection(blurbs, section.title);
            return (
              <div key={section.id} className="flex flex-col gap-3">
                <SectionCopy
                  title={section.title}
                  subtitle={section.subtitle}
                  blurb={blurb}
                  emphasizeNames={emphasizeNames}
                  emphasizePhones={emphasizePhones}
                  emphasizeTerms={emphasizeTerms}
                />
                <CardGrid
                  businesses={items}
                  cardVariant={cardVariant}
                  onSelect={onSelectBusiness}
                />
                <SectionLoadMore
                  sectionId={section.id}
                  sectionTitle={section.title}
                  shownIds={section.businessIds}
                  disabled={loadMoreDisabled}
                  onLoadMore={onLoadMoreSection}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-7", className)}>
      {showCompositionTitle ? (
        <h3 className="font-heading text-base font-semibold tracking-tight text-foreground">
          {composition.title}
        </h3>
      ) : null}
      {composition.sections.map((section, sectionIndex) => {
        const items = section.businessIds
          .map((id) => byId.get(id))
          .filter((b): b is BusinessResult => Boolean(b));
        if (items.length === 0) return null;
        const blurb = blurbForSection(blurbs, section.title);
        return (
          <section key={section.id} className="flex flex-col gap-3">
            <SectionCopy
              title={section.title}
              subtitle={section.subtitle}
              blurb={blurb}
              step={isItinerary ? sectionIndex + 1 : undefined}
              emphasizeNames={emphasizeNames}
              emphasizePhones={emphasizePhones}
              emphasizeTerms={emphasizeTerms}
            />
            <CardGrid
              businesses={items}
              cardVariant={cardVariant}
              onSelect={onSelectBusiness}
            />
            <SectionLoadMore
              sectionId={section.id}
              sectionTitle={section.title}
              shownIds={section.businessIds}
              disabled={loadMoreDisabled}
              onLoadMore={onLoadMoreSection}
            />
          </section>
        );
      })}
    </div>
  );
}
