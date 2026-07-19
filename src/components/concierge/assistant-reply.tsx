"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { BusinessResult } from "@/lib/schemas/business";
import { parseAssistantBlocks } from "@/lib/chat/parse-assistant-blocks";
import { AssistantProse } from "./assistant-prose";
import { BusinessCard } from "./business-card";

export function AssistantReply({
  content,
  businesses,
  thinking,
}: {
  content: string;
  businesses?: BusinessResult[];
  thinking?: boolean;
}) {
  if (!content && thinking) {
    return (
      <div className="flex items-center gap-2 py-1 text-sm text-muted-foreground">
        <ThinkingDots />
        <span className="tracking-tight">Thinking…</span>
      </div>
    );
  }

  // Short clarifying / chat replies stay in a soft bubble.
  if (!businesses?.length) {
    return (
      <div
        className={cn(
          "max-w-[36rem] rounded-2xl border border-border/60 bg-muted/50 px-4 py-3",
          "shadow-[0_1px_0_rgba(0,0,0,0.03)]",
        )}
      >
        <AssistantProse text={content} />
      </div>
    );
  }

  const blocks = parseAssistantBlocks(content, businesses);
  let cardIndex = 0;

  return (
    <div className="flex w-full max-w-2xl flex-col gap-5">
      {blocks.map((block, i) => {
        if (block.type === "text") {
          const text = block.text.trim();
          if (!text) return null;
          return (
            <motion.div
              key={`t-${i}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <AssistantProse text={text} />
            </motion.div>
          );
        }

        const index = cardIndex++;
        return (
          <motion.div
            key={`b-${block.business.id}-${i}`}
            className="max-w-md pl-0 sm:pl-1"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.04 }}
          >
            <BusinessCard
              business={block.business}
              index={index}
              variant="compact"
            />
          </motion.div>
        );
      })}
    </div>
  );
}

function ThinkingDots() {
  return (
    <span className="flex items-center gap-1" aria-hidden>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="inline-block size-1.5 rounded-full bg-foreground/40"
          animate={{ opacity: [0.35, 1, 0.35] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.18 }}
        />
      ))}
    </span>
  );
}
