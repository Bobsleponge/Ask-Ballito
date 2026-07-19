import { z } from "zod";
import { businessAttributesSchema } from "@/lib/schemas/business-attributes";
import type { PromptMeta } from "./types";

export const ENRICHMENT_PROMPT: PromptMeta<"enrichment"> = {
  name: "enrichment",
  version: "v1",
};

export const enrichmentExtractSchema = z.object({
  /** Concrete services/offerings mentioned or clearly implied. */
  services: z.array(z.string()).default([]),
  /** Short search aliases and SEO keywords (brands, techniques, specialties). */
  keywords: z.array(z.string()).default([]),
  /** Amenity / vibe flags only when evidence exists; otherwise leave null/omit. */
  attributes: businessAttributesSchema.default({}),
  /** One-sentence grounded summary of what the business offers. */
  summary: z.string().nullable().default(null),
});

export type EnrichmentExtract = z.infer<typeof enrichmentExtractSchema>;

export function buildEnrichmentSystem(): string {
  return [
    "You extract structured service and keyword data for a local business SEO index.",
    "Sources are REAL Google Places listing fields and REAL Google customer reviews only.",
    "Never invent, guess, or add typical industry services that are not explicitly supported by the text.",
    "If a service or keyword is not clearly stated or strongly paraphrased in the sources, omit it.",
    "Empty arrays are correct when evidence is thin.",
    "services: specific offerings customers would ask for, only when evidenced (e.g. 'acrylic nails' only if reviews/listing say acrylic).",
    "keywords: short searchable aliases drawn from those same evidenced services/terms. Lowercase preferred.",
    "attributes: set amenity flags only when clearly evidenced; otherwise leave unset/null.",
    "summary: optional one sentence grounded strictly in the sources — no marketing fluff.",
    "Prefer precision over recall — fabricated services destroy search quality.",
  ].join(" ");
}

export function buildEnrichmentUserPayload(input: {
  name: string;
  category: string | null;
  types: string[];
  description: string | null;
  address: string | null;
  verticals: string[];
  reviews: string[];
}): string {
  const lines = [
    `Name: ${input.name}`,
    `Category: ${input.category ?? "unknown"}`,
    `Types: ${input.types.join(", ") || "none"}`,
    `Verticals: ${input.verticals.join(", ") || "none"}`,
    `Description: ${input.description ?? "none"}`,
    `Address: ${input.address ?? "none"}`,
    "Google customer reviews (verbatim):",
  ];

  if (input.reviews.length === 0) {
    lines.push("(no Google reviews provided for this business)");
  } else {
    input.reviews.forEach((r, i) => {
      lines.push(`[${i + 1}] ${r}`);
    });
  }

  return lines.join("\n");
}
