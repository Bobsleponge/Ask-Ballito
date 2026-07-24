"use client";

import { Fragment } from "react";
import { cn } from "@/lib/utils";
import { emphasizeKeyFacts } from "@/lib/chat/emphasize-key-facts";

/**
 * Light formatting for assistant copy: paragraphs, soft line breaks, **bold**.
 * Optional names/phones are auto-emphasised when the model forgot the markers.
 */
export function AssistantProse({
  text,
  className,
  emphasizeNames,
  emphasizePhones,
  emphasizeTerms,
}: {
  text: string;
  className?: string;
  emphasizeNames?: Array<string | null | undefined>;
  emphasizePhones?: Array<string | null | undefined>;
  /** Ask-relevant phrases (e.g. 24-hour, kid-friendly) — bold when present. */
  emphasizeTerms?: Array<string | null | undefined>;
}) {
  const emphasized = emphasizeKeyFacts(text, {
    names: emphasizeNames,
    phones: emphasizePhones,
    terms: emphasizeTerms,
  });
  const paragraphs = emphasized
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) return null;

  return (
    <div
      className={cn(
        "flex max-w-[40rem] flex-col gap-3.5 text-[15px] leading-[1.7] tracking-[-0.01em] text-foreground",
        className,
      )}
    >
      {paragraphs.map((para, i) => (
        <p key={i} className="m-0">
          {para.split("\n").map((line, j, arr) => (
            <Fragment key={j}>
              <InlineMarks text={line} />
              {j < arr.length - 1 ? <br /> : null}
            </Fragment>
          ))}
        </p>
      ))}
    </div>
  );
}

function InlineMarks({ text }: { text: string }) {
  // Split on **bold** segments
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        const bold = part.match(/^\*\*([^*]+)\*\*$/);
        if (bold) {
          return (
            <strong key={i} className="font-semibold text-foreground">
              {bold[1]}
            </strong>
          );
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}
