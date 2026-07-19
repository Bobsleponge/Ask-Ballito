import type { BusinessResult } from "@/lib/schemas/business";

export type AssistantBlock =
  | { type: "text"; text: string }
  | { type: "business"; business: BusinessResult };

const MARKER_RE = /\[\[biz:([^\]]+)\]\]/g;
const MARKER_SPLIT_RE = /(\[\[biz:[^\]]+\]\])/g;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Turn assistant prose + optional [[biz:id]] markers into interleaved text/card blocks.
 * Falls back to placing a card just under the first mention of each business name.
 */
export function parseAssistantBlocks(
  content: string,
  businesses: BusinessResult[],
): AssistantBlock[] {
  if (!content.trim()) return [];

  const byId = new Map(businesses.map((b) => [b.id, b]));
  const used = new Set<string>();
  const blocks: AssistantBlock[] = [];

  const chunks = content.split(MARKER_SPLIT_RE);
  for (const chunk of chunks) {
    const marker = chunk.match(/^\[\[biz:([^\]]+)\]\]$/);
    if (marker) {
      const biz = byId.get(marker[1].trim());
      if (biz && !used.has(biz.id)) {
        used.add(biz.id);
        blocks.push({ type: "business", business: biz });
      }
      continue;
    }
    if (chunk.length > 0) {
      blocks.push({ type: "text", text: chunk });
    }
  }

  // Name-based placement for businesses the model named but forgot to mark.
  const unused = businesses.filter((b) => !used.has(b.id));
  if (unused.length === 0) {
    return mergeAdjacentText(blocks);
  }

  const named = [...unused].sort((a, b) => b.name.length - a.name.length);
  let next: AssistantBlock[] = [];

  for (const block of blocks) {
    if (block.type !== "text") {
      next.push(block);
      continue;
    }

    let remaining = block.text;
    while (remaining.length > 0) {
      let earliest: { index: number; biz: BusinessResult; len: number } | null =
        null;
      for (const biz of named) {
        if (used.has(biz.id)) continue;
        const re = new RegExp(`\\b${escapeRegExp(biz.name)}\\b`, "i");
        const m = re.exec(remaining);
        if (!m) continue;
        if (!earliest || m.index < earliest.index) {
          earliest = { index: m.index, biz, len: m[0].length };
        }
      }

      if (!earliest) {
        if (remaining.length > 0) next.push({ type: "text", text: remaining });
        break;
      }

      const before = remaining.slice(0, earliest.index + earliest.len);
      const after = remaining.slice(earliest.index + earliest.len);
      // Prefer card after the sentence that contains the name.
      const sentenceEnd = after.search(/[.!?\n]/);
      let textWithMention = before;
      let rest = after;
      if (sentenceEnd >= 0) {
        textWithMention = before + after.slice(0, sentenceEnd + 1);
        rest = after.slice(sentenceEnd + 1);
      }

      if (textWithMention) next.push({ type: "text", text: textWithMention });
      used.add(earliest.biz.id);
      next.push({ type: "business", business: earliest.biz });
      remaining = rest;
    }
  }

  // Any still-unused places trail at the end (model never named them).
  for (const biz of businesses) {
    if (!used.has(biz.id)) {
      next.push({ type: "business", business: biz });
    }
  }

  return mergeAdjacentText(next);
}

function mergeAdjacentText(blocks: AssistantBlock[]): AssistantBlock[] {
  const out: AssistantBlock[] = [];
  for (const b of blocks) {
    const last = out[out.length - 1];
    if (b.type === "text" && last?.type === "text") {
      last.text += b.text;
    } else if (b.type === "text" && !b.text) {
      continue;
    } else {
      out.push(b.type === "text" ? { ...b } : b);
    }
  }
  return out;
}

/** Strip markers for history / plain text. */
export function stripBizMarkers(content: string): string {
  return content.replace(MARKER_RE, "").replace(/\n{3,}/g, "\n\n").trim();
}
