"use client";

import { useEffect, useState } from "react";
import { Lightbulb } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { SUGGESTION_CARDS, SEED_TRENDING } from "@/config/discover";
import { analytics } from "@/lib/analytics/events";

export function CommandMenu({ onPick }: { onPick: (prompt: string) => void }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const ideas = [
    ...SUGGESTION_CARDS.map((c) => c.prompt),
    ...SEED_TRENDING.map((t) => t.query),
  ];

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-9 gap-2 rounded-xl text-muted-foreground"
        onClick={() => {
          analytics.capture("search_opened");
          setOpen(true);
        }}
      >
        <Lightbulb className="size-4" />
        Quick ideas
        <kbd className="ml-1 hidden rounded border bg-muted px-1.5 text-[10px] sm:inline">
          ⌘K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Type a request or pick an idea..." />
        <CommandList>
          <CommandEmpty>No ideas found.</CommandEmpty>
          <CommandGroup heading="Popular requests">
            {ideas.map((prompt) => (
              <CommandItem
                key={prompt}
                onSelect={() => {
                  setOpen(false);
                  analytics.capture("search_submitted", { source: "command" });
                  onPick(prompt);
                }}
              >
                {prompt}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
