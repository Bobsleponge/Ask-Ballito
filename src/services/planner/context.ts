import type { City } from "@/config/cities";
import type { ChatMessage } from "@/lib/schemas/chat";
import {
  emptyConstraintModel,
  emptyEntityModel,
  type ConversationContext,
  type EntityModel,
} from "./types";
import { GEO_REFERENCES } from "@/config/geo-references";

const AREA_PATTERNS: { re: RegExp; field: keyof EntityModel; value: string }[] =
  [
    ...GEO_REFERENCES.flatMap((g) => {
      const names = [g.label, ...(g.aliases ?? [])];
      return names.map((name) => ({
        re: new RegExp(`\\b${escapeRegExp(name)}\\b`, "i"),
        field: (g.kind === "estate"
          ? "estates"
          : g.kind === "landmark"
            ? "landmarks"
            : "locations") as keyof EntityModel,
        value: g.label,
      }));
    }),
  ];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function pushUnique(arr: string[], value: string) {
  if (!arr.some((x) => x.toLowerCase() === value.toLowerCase())) {
    arr.push(value);
  }
}

/** Extract sticky location-like entities from recent conversation text. */
export function extractStickyFromHistory(history: ChatMessage[]): EntityModel {
  const sticky = emptyEntityModel();
  const recent = history.slice(-8);
  for (const m of recent) {
    for (const { re, field, value } of AREA_PATTERNS) {
      if (re.test(m.content)) {
        const list = sticky[field];
        if (Array.isArray(list)) pushUnique(list, value);
      }
    }
  }
  return sticky;
}

export function buildConversationContext(opts: {
  city: City;
  history?: ChatMessage[];
}): ConversationContext {
  const history = opts.history ?? [];
  return {
    city: opts.city,
    history: history.slice(-8),
    stickyEntities: extractStickyFromHistory(history),
    stickyConstraints: {},
  };
}

/** Current-turn entities win; sticky fills gaps. */
export function mergeEntities(
  sticky: EntityModel,
  turn: EntityModel,
): { merged: EntityModel; stickyUsed: boolean } {
  const merged = emptyEntityModel();
  let stickyUsed = false;

  for (const key of Object.keys(merged) as (keyof EntityModel)[]) {
    if (turn[key].length > 0) {
      merged[key] = [...turn[key]];
    } else if (sticky[key].length > 0) {
      merged[key] = [...sticky[key]];
      stickyUsed = true;
    }
  }

  return { merged, stickyUsed };
}

export function mergeConstraints<T extends ReturnType<typeof emptyConstraintModel>>(
  _sticky: Partial<T>,
  turn: T,
): T {
  // V2 day-one: prefer turn constraints; sticky constraint merge can expand later.
  return turn;
}
