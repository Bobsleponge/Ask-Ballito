import type { Json } from "@/types/database";
import {
  emptyConstraintModel,
  emptyEntityModel,
  type ConstraintModel,
  type EntityModel,
} from "./types";

export type StickySummary = {
  workflow?: string | null;
  goalType?: string | null;
  updatedAt?: string | null;
  constraints?: {
    openNow?: boolean | null;
    budget?: ConstraintModel["budget"];
    partySize?: number | null;
    distanceLabel?: string | null;
  } | null;
  cuisines?: string[] | null;
  locationLabel?: string | null;
};

export function parseStickySummary(raw: Json | null | undefined): StickySummary | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as StickySummary;
}

/** Map persisted sticky JSON into planner context fillers. */
export function stickySummaryToContext(summary: StickySummary | null): {
  stickyEntities: EntityModel;
  stickyConstraints: Partial<ConstraintModel>;
} {
  const stickyEntities = emptyEntityModel();
  const stickyConstraints: Partial<ConstraintModel> = {};

  if (!summary) {
    return { stickyEntities, stickyConstraints };
  }

  if (Array.isArray(summary.cuisines)) {
    for (const c of summary.cuisines) {
      if (typeof c === "string" && c.trim()) {
        stickyEntities.cuisines.push(c.trim());
      }
    }
  }

  if (typeof summary.locationLabel === "string" && summary.locationLabel.trim()) {
    stickyEntities.locations.push(summary.locationLabel.trim());
  }

  const c = summary.constraints;
  if (c && typeof c === "object") {
    const base = emptyConstraintModel();
    if (c.openNow != null) base.openNow = c.openNow;
    if (c.budget != null) base.budget = c.budget;
    if (c.partySize != null) base.partySize = c.partySize;
    if (typeof c.distanceLabel === "string") {
      base.distanceLabel = c.distanceLabel;
    }
    stickyConstraints.openNow = base.openNow;
    stickyConstraints.budget = base.budget;
    stickyConstraints.partySize = base.partySize;
    stickyConstraints.distanceLabel = base.distanceLabel;
  }

  return { stickyEntities, stickyConstraints };
}
