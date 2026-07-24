"use client";

import { Store } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useConversationStore } from "@/lib/store/conversation-store";
import { ExperienceResults } from "./experience-results";

export function ResultsSheet() {
  const businesses = useConversationStore((s) => s.activeBusinesses);
  const composition = useConversationStore((s) => s.activeComposition);
  const selectBusiness = useConversationStore((s) => s.selectBusiness);
  const citySlug = useConversationStore((s) => s.citySlug);
  const messages = useConversationStore((s) => s.messages);
  const appendSectionBusinesses = useConversationStore(
    (s) => s.appendSectionBusinesses,
  );
  if (businesses.length === 0) return null;

  const latestAssistant = [...messages]
    .reverse()
    .find((m) => m.role === "assistant" && m.businesses?.length);
  const latestUser = [...messages].reverse().find((m) => m.role === "user");

  const handleLoadMoreSection = async (section: {
    id: string;
    title: string;
    shownIds: string[];
  }) => {
    if (!citySlug || !latestAssistant) return [];
    const exclude = new Set<string>(section.shownIds);
    for (const b of businesses) exclude.add(b.id);
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
    const data = (await res.json()) as { businesses?: typeof businesses };
    const incoming = data.businesses ?? [];
    if (incoming.length > 0) {
      appendSectionBusinesses(latestAssistant.id, section.id, incoming);
    }
    return incoming;
  };

  const title = composition?.title ?? "Recommended places";
  const description =
    composition?.strategy === "itinerary"
      ? "A suggested sequence for your day."
      : composition?.strategy === "comparison"
        ? "Side-by-side options for your request."
        : composition?.strategy === "nearest_first"
          ? "Places ordered from nearest to farthest."
          : composition?.strategy === "grouped_sections"
            ? "Matches grouped for easier browsing."
            : "Matches for your latest request.";

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Store className="size-4" />
          Results
          <Badge variant="secondary">{businesses.length}</Badge>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <ScrollArea className="h-full px-4 pb-8">
          <ExperienceResults
            businesses={businesses}
            composition={composition}
            onSelectBusiness={(b) => selectBusiness(b.id, b)}
            onLoadMoreSection={
              citySlug && latestAssistant ? handleLoadMoreSection : undefined
            }
          />
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
