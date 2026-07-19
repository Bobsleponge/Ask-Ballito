"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SUGGESTION_PROMPTS } from "./suggestions";
import type { City } from "@/config/cities";

export function EmptyState({
  city,
  onPick,
}: {
  city: City;
  onPick: (prompt: string) => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col items-center gap-4"
      >
        <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Sparkles className="size-6" />
        </span>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          What are you looking for in {city.name}?
        </h1>
        <p className="max-w-md text-muted-foreground">
          Your local AI concierge for the best places to eat, shop, relax, and
          explore. Just ask in your own words.
        </p>
      </motion.div>

      <div className="mt-8 flex flex-wrap justify-center gap-2">
        {SUGGESTION_PROMPTS.slice(0, 6).map((prompt, i) => (
          <motion.div
            key={prompt}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 + i * 0.04 }}
          >
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => onPick(prompt)}
            >
              {prompt}
            </Button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
