/**
 * Canonical text embedded for semantic search. Shared by ingest + enrichment
 * + owner portal so discovery stays aligned with what businesses say they offer.
 */

import { ATTRIBUTE_EMBEDDING_LABELS } from "@/config/vertical-listing-fields";

export function buildEmbeddingText(input: {
  name: string;
  category?: string | null;
  categories?: string[] | null;
  description?: string | null;
  address?: string | null;
  metadata?: Record<string, unknown> | null;
  /** Owner-listed services (merged with enrichment metadata.services). */
  ownerServices?: string[] | null;
  /** Owner search aliases (merged with enrichment metadata.keywords). */
  ownerKeywords?: string[] | null;
  /** Owner amenity flags — override / merge onto metadata.attributes. */
  ownerAttributes?: Record<string, unknown> | null;
  /** Owner hours override as weekday description lines. */
  hoursDescriptions?: string[] | null;
  /** Active special titles / discount labels for discovery. */
  specials?:
    | { title: string; discountLabel?: string | null; kind?: string | null }[]
    | null;
  /** Menu / priced service options from the owner portal. */
  menuItems?:
    | { name: string; description?: string | null; category?: string | null }[]
    | null;
}): string {
  const meta = input.metadata ?? {};
  const metaServices = stringArray(meta.services);
  const metaKeywords = stringArray(meta.keywords);
  const services = uniqueStrings([
    ...(input.ownerServices ?? []),
    ...metaServices,
  ]);
  const keywords = uniqueStrings([
    ...(input.ownerKeywords ?? []),
    ...metaKeywords,
  ]);
  const verticals = stringArray(meta.verticals);
  const types = stringArray(meta.types);

  const mergedAttrs: Record<string, unknown> = {
    ...(typeof meta.attributes === "object" && meta.attributes
      ? (meta.attributes as Record<string, unknown>)
      : {}),
    ...(input.ownerAttributes ?? {}),
  };
  const attrBits = Object.entries(mergedAttrs)
    .filter(
      ([, v]) => v === true || (typeof v === "string" && v.length > 0),
    )
    .map(([k, v]) => {
      const label = ATTRIBUTE_EMBEDDING_LABELS[k] ?? k;
      return v === true ? label : `${label}:${v}`;
    });

  const menuBits = (input.menuItems ?? [])
    .map((item) => {
      const name = item.name?.trim();
      if (!name) return null;
      const parts = [name];
      if (item.category?.trim()) parts.push(`(${item.category.trim()})`);
      if (item.description?.trim()) parts.push(item.description.trim());
      return parts.join(" ");
    })
    .filter((s): s is string => Boolean(s));

  const specialBits = (input.specials ?? [])
    .map((s) => {
      const title = s.title?.trim();
      if (!title) return null;
      const parts = [title];
      if (s.discountLabel?.trim()) parts.push(s.discountLabel.trim());
      if (s.kind?.trim()) parts.push(`(${s.kind.trim()})`);
      return parts.join(" ");
    })
    .filter((s): s is string => Boolean(s));

  const hours = (input.hoursDescriptions ?? []).filter(
    (h) => typeof h === "string" && h.trim().length > 0,
  );

  return [
    input.name,
    input.category,
    (input.categories ?? []).join(", "),
    types.join(", "),
    input.description,
    services.length ? `services: ${services.join(", ")}` : null,
    keywords.length ? `keywords: ${keywords.join(", ")}` : null,
    menuBits.length ? `menu: ${menuBits.join("; ")}` : null,
    specialBits.length ? `specials: ${specialBits.join("; ")}` : null,
    attrBits.length ? `attributes: ${attrBits.join(", ")}` : null,
    hours.length ? `hours: ${hours.join("; ")}` : null,
    verticals.length ? `verticals: ${verticals.join(", ")}` : null,
    input.address,
  ]
    .filter(Boolean)
    .join(". ");
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (s): s is string => typeof s === "string" && s.trim().length > 0,
  );
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const v = raw.trim();
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}
