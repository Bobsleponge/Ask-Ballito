import { lookupGeoReference } from "@/config/geo-references";
import type { EntityModel, LocationRef } from "./types";

/**
 * Resolve a distance origin. Never falls back to city centre.
 * Priority: turn locations → estates → landmarks → sticky (same order).
 */
export function resolveLocationRef(
  turn: EntityModel,
  sticky: EntityModel,
): LocationRef | null {
  const fromTurn = pickFromEntities(turn, "turn");
  if (fromTurn) return fromTurn;
  return pickFromEntities(sticky, "sticky");
}

function pickFromEntities(
  entities: EntityModel,
  source: "turn" | "sticky",
): LocationRef | null {
  for (const label of entities.locations) {
    const ref = toRef(label, "location", source);
    if (ref) return ref;
  }
  for (const label of entities.estates) {
    const ref = toRef(label, "estate", source);
    if (ref) return ref;
  }
  for (const label of entities.landmarks) {
    const ref = toRef(label, "landmark", source);
    if (ref) return ref;
  }
  // Label-only refs (no coords) still useful for display; skip distance score.
  const first =
    entities.locations[0] ?? entities.estates[0] ?? entities.landmarks[0];
  if (first) {
    const kind = entities.locations[0]
      ? "location"
      : entities.estates[0]
        ? "estate"
        : "landmark";
    return { kind, label: first, lat: null, lng: null, source };
  }
  return null;
}

function toRef(
  label: string,
  kind: LocationRef["kind"],
  source: "turn" | "sticky",
): LocationRef | null {
  const geo = lookupGeoReference(label);
  if (!geo) return null;
  return {
    kind: geo.kind ?? kind,
    label: geo.label,
    lat: geo.lat,
    lng: geo.lng,
    source,
  };
}

export function parseDistanceLabel(label: string | null): number | null {
  if (!label) return null;
  const lower = label.toLowerCase();
  if (/walk/.test(lower)) return 2000;
  if (/nearby|close|near/.test(lower)) return 5000;
  const km = lower.match(/(\d+(?:\.\d+)?)\s*km/);
  if (km) return Math.round(Number(km[1]) * 1000);
  const m = lower.match(/(\d+)\s*m\b/);
  if (m) return Number(m[1]);
  return null;
}

export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
