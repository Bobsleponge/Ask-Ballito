/**
 * Known estates / landmarks with coordinates for LocationRef distance ranking.
 * Never use city centre as a default distance origin.
 */

export interface GeoReference {
  label: string;
  kind: "location" | "estate" | "landmark";
  lat: number;
  lng: number;
  aliases?: string[];
}

export const GEO_REFERENCES: readonly GeoReference[] = [
  {
    label: "Salt Rock",
    kind: "location",
    lat: -29.5035,
    lng: 31.2378,
    aliases: ["saltrock"],
  },
  {
    label: "Ballito",
    kind: "location",
    lat: -29.5387,
    lng: 31.2143,
  },
  {
    label: "Zimbali",
    kind: "estate",
    lat: -29.551,
    lng: 31.205,
    aliases: ["zimbali estate", "zimbali coastal resort"],
  },
  {
    label: "Simbithi",
    kind: "estate",
    lat: -29.525,
    lng: 31.195,
    aliases: ["simbithi eco estate"],
  },
  {
    label: "Elaleni",
    kind: "estate",
    lat: -29.518,
    lng: 31.208,
    aliases: ["elaleni coastal forest estate"],
  },
  {
    label: "Willard Beach",
    kind: "landmark",
    lat: -29.5421,
    lng: 31.2141,
    aliases: ["willards beach"],
  },
  {
    label: "Compensation Beach",
    kind: "landmark",
    lat: -29.5398,
    lng: 31.2165,
  },
  {
    label: "Ballito Junction",
    kind: "landmark",
    lat: -29.5342,
    lng: 31.2119,
    aliases: ["ballito junction mall"],
  },
] as const;

function normalise(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export function lookupGeoReference(
  label: string,
): GeoReference | undefined {
  const n = normalise(label);
  return GEO_REFERENCES.find((g) => {
    if (normalise(g.label) === n) return true;
    return (g.aliases ?? []).some((a) => normalise(a) === n || n.includes(normalise(a)));
  });
}
