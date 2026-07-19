"use client";

import { Fragment } from "react";
import { cn } from "@/lib/utils";

/**
 * Light formatting for assistant copy: paragraphs, soft line breaks, **bold**.
 */
export function AssistantProse({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const paragraphs = text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) return null;

  return (
    <div
      className={cn(
        "flex max-w-[40rem] flex-col gap-3.5 text-[15px] leading-[1.7] tracking-[-0.01em] text-foreground/90",
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
            <strong
              key={i}
              className="font-semibold text-foreground"
            >
              {bold[1]}
            </strong>
          );
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}
