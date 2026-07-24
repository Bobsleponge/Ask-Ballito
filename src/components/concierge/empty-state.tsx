"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ChatInput } from "./chat-input";
import { SUGGESTION_CARDS } from "@/config/discover";
import type { City } from "@/config/cities";
import { cn } from "@/lib/utils";

function greetingForHour(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** Keep the first viewport light — a handful of prompts, not a directory. */
const HERO_PROMPTS = SUGGESTION_CARDS.slice(0, 4);

export function EmptyState({
  city,
  onPick,
  onSend,
}: {
  city: City;
  onPick: (prompt: string) => void;
  onSend: (message: string) => void;
}) {
  const [greeting, setGreeting] = useState("Welcome");

  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      setGreeting(greetingForHour(new Date().getHours()));
    });
    return () => window.cancelAnimationFrame(id);
  }, []);

  return (
    <div className="hero-atmosphere relative flex flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-4 py-12 sm:py-16">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center"
        >
          <p className="font-heading text-sm font-medium tracking-wide text-primary">
            Ask Ballito
          </p>
          <h1 className="font-heading mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {greeting}
            <span className="text-muted-foreground"> — </span>
            {city.name}
          </h1>
          <p className="mt-3 text-base text-muted-foreground sm:text-lg">
            Your AI concierge for everything local. Just ask.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.08 }}
          className="mt-8"
        >
          <ChatInput
            variant="hero"
            onSend={onSend}
            placeholder={`Ask anything about ${city.name}…`}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.16 }}
          className="mt-6 flex flex-wrap justify-center gap-2"
          aria-label="Try asking"
        >
          {HERO_PROMPTS.map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={() => onPick(card.prompt)}
              className={cn(
                "inline-flex min-h-9 items-center rounded-full border border-border/70 bg-card/80 px-3.5 text-sm text-muted-foreground",
                "transition-colors hover:border-primary/30 hover:bg-accent hover:text-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              {card.title}
            </button>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
