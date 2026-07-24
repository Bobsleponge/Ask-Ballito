"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BusinessResult } from "@/lib/schemas/business";
import type { CompositionPayload } from "@/services/composition/types";
import { scrubInvalidBizMarkers } from "@/lib/chat/ground-assistant-text";
import { stripBizMarkers } from "@/lib/chat/parse-assistant-blocks";
import {
  parseRecommendationNarration,
} from "@/lib/chat/parse-recommendation-narration";
import { askRelevantTerms } from "@/lib/chat/ask-relevant-terms";
import { AssistantProse } from "./assistant-prose";
import { ExperienceResults } from "./experience-results";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useConversationStore } from "@/lib/store/conversation-store";

const THINKING_STAGES = [
  "Searching Ballito…",
  "Finding local matches…",
  "Ranking recommendations…",
] as const;

function ResultsSkeleton() {
  return (
    <div
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
      aria-hidden
    >
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-coastal ring-1 ring-ocean/5"
        >
          <Skeleton className="aspect-[16/10] w-full rounded-none" />
          <div className="space-y-2.5 p-3.5">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <div className="flex gap-1.5 pt-1">
              <Skeleton className="h-8 w-14 rounded-full" />
              <Skeleton className="h-8 w-14 rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ThinkingStatus() {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setStage((s) => (s + 1) % THINKING_STAGES.length);
    }, 2200);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div
      className="flex items-center gap-3 rounded-2xl border border-border/50 bg-muted/40 px-4 py-3"
      role="status"
      aria-live="polite"
    >
      <ThinkingDots />
      <span className="text-sm tracking-tight text-muted-foreground">
        {THINKING_STAGES[stage]}
      </span>
    </div>
  );
}

export function AssistantReply({
  content,
  businesses,
  composition,
  thinking,
  streaming,
  showTryAgain,
  onTryAgain,
  tryAgainBusy,
  messageId,
}: {
  content: string;
  businesses?: BusinessResult[];
  composition?: CompositionPayload | null;
  thinking?: boolean;
  streaming?: boolean;
  showTryAgain?: boolean;
  onTryAgain?: () => void;
  tryAgainBusy?: boolean;
  messageId?: string;
}) {
  const citySlug = useConversationStore((s) => s.citySlug);
  const appendSectionBusinesses = useConversationStore(
    (s) => s.appendSectionBusinesses,
  );

  const handleLoadMoreSection = async (section: {
    id: string;
    title: string;
    shownIds: string[];
  }) => {
    if (!citySlug || !messageId) return [];
    const latestUser = [...useConversationStore.getState().messages]
      .reverse()
      .find((m) => m.role === "user");
    const exclude = new Set<string>(section.shownIds);
    for (const b of businesses ?? []) exclude.add(b.id);

    const res = await fetch("/api/recommendations/more", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        city: citySlug,
        sectionId: section.id,
        sectionTitle: section.title,
        ask: latestUser?.content?.slice(0, 500) ?? "",
        excludeBusinessIds: [...exclude],
        limit: 6,
      }),
    });
    if (!res.ok) throw new Error("load_more_failed");
    const data = (await res.json()) as { businesses?: BusinessResult[] };
    const incoming = data.businesses ?? [];
    if (incoming.length > 0) {
      appendSectionBusinesses(messageId, section.id, incoming);
    }
    return incoming;
  };
  if (!content && thinking) {
    return (
      <div className="flex w-full max-w-5xl flex-col gap-4">
        <ThinkingStatus />
        <ResultsSkeleton />
      </div>
    );
  }

  if (!businesses?.length) {
    return (
      <div className="flex w-full max-w-5xl flex-col gap-4">
        <div
          className={cn(
            "max-w-[38rem] rounded-2xl rounded-bl-md border border-border/60 bg-card px-4 py-3 shadow-coastal",
            streaming && "ring-1 ring-aqua/30",
          )}
        >
          <AssistantProse text={scrubInvalidBizMarkers(content)} />
        </div>
        {streaming ? <ResultsSkeleton /> : null}
      </div>
    );
  }

  const scrubbed = stripBizMarkers(scrubInvalidBizMarkers(content));
  const sectionTitles = composition?.sections.map((s) => s.title) ?? [];
  const narration = parseRecommendationNarration(scrubbed, sectionTitles);
  const intro = narration.intro.trim();
  const emphasizeNames = businesses.map((b) => b.name);
  const emphasizePhones = businesses.map((b) => b.phone);
  const latestUser = [...useConversationStore.getState().messages]
    .reverse()
    .find((m) => m.role === "user");
  const emphasizeTerms = askRelevantTerms(latestUser?.content);

  return (
    <div className="flex w-full max-w-5xl flex-col gap-5">
      {intro ? (
        <div
          className={cn(
            "max-w-[40rem] rounded-2xl rounded-bl-md border border-border/60 bg-card px-4 py-3 shadow-coastal",
            streaming && "ring-1 ring-aqua/30",
          )}
        >
          <AssistantProse
            text={intro}
            emphasizeNames={emphasizeNames}
            emphasizePhones={emphasizePhones}
            emphasizeTerms={emphasizeTerms}
          />
        </div>
      ) : null}

      <ExperienceResults
        businesses={businesses}
        composition={composition}
        cardVariant="compact"
        sectionBlurbs={narration.sectionBlurbs}
        emphasizeTerms={emphasizeTerms}
        loadMoreDisabled={Boolean(streaming)}
        onLoadMoreSection={
          messageId && citySlug ? handleLoadMoreSection : undefined
        }
        onSelectBusiness={(b) => {
          useConversationStore.getState().selectBusiness(b.id, b);
        }}
      />

      {showTryAgain && onTryAgain ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-2 rounded-xl"
            disabled={tryAgainBusy}
            onClick={onTryAgain}
            aria-label="Try again with different options"
          >
            <RefreshCw
              className={cn("size-3.5", tryAgainBusy && "animate-spin")}
            />
            Try again
          </Button>
          <p className="text-xs text-muted-foreground">
            One fresh list — excludes places already shown
          </p>
        </div>
      ) : null}
    </div>
  );
}

function ThinkingDots() {
  return (
    <span className="flex items-center gap-1" aria-hidden>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="inline-block size-1.5 rounded-full bg-primary/60"
          animate={{ opacity: [0.35, 1, 0.35] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.18 }}
        />
      ))}
    </span>
  );
}
