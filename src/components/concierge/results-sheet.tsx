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
  if (businesses.length === 0) return null;

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
          />
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
