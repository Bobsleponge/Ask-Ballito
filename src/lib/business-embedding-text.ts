/**
 * Canonical text embedded for semantic search. Shared by ingest + enrichment
 * so discovery and SEO corpora stay aligned.
 */
export function buildEmbeddingText(input: {
  name: string;
  category?: string | null;
  categories?: string[] | null;
  description?: string | null;
  address?: string | null;
  metadata?: Record<string, unknown> | null;
}): string {
  const meta = input.metadata ?? {};
  const services = Array.isArray(meta.services)
    ? meta.services.filter((s): s is string => typeof s === "string")
    : [];
  const keywords = Array.isArray(meta.keywords)
    ? meta.keywords.filter((s): s is string => typeof s === "string")
    : [];
  const verticals = Array.isArray(meta.verticals)
    ? meta.verticals.filter((s): s is string => typeof s === "string")
    : [];
  const types = Array.isArray(meta.types)
    ? meta.types.filter((s): s is string => typeof s === "string")
    : [];
  const attrs = meta.attributes;
  const attrBits =
    attrs && typeof attrs === "object"
      ? Object.entries(attrs as Record<string, unknown>)
          .filter(([, v]) => v === true || (typeof v === "string" && v.length > 0))
          .map(([k, v]) => (v === true ? k : `${k}:${v}`))
      : [];

  return [
    input.name,
    input.category,
    (input.categories ?? []).join(", "),
    types.join(", "),
    input.description,
    services.length ? `services: ${services.join(", ")}` : null,
    keywords.length ? `keywords: ${keywords.join(", ")}` : null,
    attrBits.length ? `attributes: ${attrBits.join(", ")}` : null,
    verticals.length ? `verticals: ${verticals.join(", ")}` : null,
    input.address,
  ]
    .filter(Boolean)
    .join(". ");
}
