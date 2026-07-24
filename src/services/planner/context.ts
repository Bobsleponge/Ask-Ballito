import type { City } from "@/config/cities";
import type { ChatMessage } from "@/lib/schemas/chat";
import {
  emptyEntityModel,
  type ConstraintModel,
  type ConversationContext,
  type EntityModel,
} from "./types";
import { GEO_REFERENCES } from "@/config/geo-references";
import {
  stickySummaryToContext,
  type StickySummary,
} from "./sticky-summary";

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
  /** Persisted conversation sticky_summary (JSON), if any. */
  stickySummary?: StickySummary | null;
}): ConversationContext {
  const history = opts.history ?? [];
  const fromHistory = extractStickyFromHistory(history);
  const fromSummary = stickySummaryToContext(opts.stickySummary ?? null);
  const { merged: stickyEntities } = mergeEntities(
    fromSummary.stickyEntities,
    fromHistory,
  );

  return {
    city: opts.city,
    history: history.slice(-8),
    stickyEntities,
    stickyConstraints: fromSummary.stickyConstraints,
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

/** Turn wins when set; sticky fills null/empty scalar constraints. */
export function mergeConstraints(
  sticky: Partial<ConstraintModel>,
  turn: ConstraintModel,
): ConstraintModel {
  return {
    ...turn,
    openNow: turn.openNow ?? sticky.openNow ?? null,
    budget: turn.budget ?? sticky.budget ?? null,
    partySize: turn.partySize ?? sticky.partySize ?? null,
    distanceLabel: turn.distanceLabel ?? sticky.distanceLabel ?? null,
    distanceMeters: turn.distanceMeters ?? sticky.distanceMeters ?? null,
    emergency: turn.emergency ?? sticky.emergency ?? null,
  };
}
