import { z } from "zod";

/**
 * Structured amenity / vibe flags nested under businesses.metadata.attributes.
 * Prepared for a future knowledge graph; ranking reads these when present.
 */
export const businessAttributesSchema = z.object({
  familyFriendly: z.boolean().nullable().optional(),
  romantic: z.boolean().nullable().optional(),
  kidsArea: z.boolean().nullable().optional(),
  seaView: z.boolean().nullable().optional(),
  wheelchair: z.boolean().nullable().optional(),
  petFriendly: z.boolean().nullable().optional(),
  breakfast: z.boolean().nullable().optional(),
  parking: z.boolean().nullable().optional(),
  outdoorSeating: z.boolean().nullable().optional(),
  noiseLevel: z.enum(["quiet", "moderate", "lively"]).nullable().optional(),
  bookingRequired: z.boolean().nullable().optional(),
  rainFriendly: z.boolean().nullable().optional(),
  lateNight: z.boolean().nullable().optional(),
});

export type BusinessAttributes = z.infer<typeof businessAttributesSchema>;

export function extractAttributes(
  metadata: Record<string, unknown> | null | undefined,
): BusinessAttributes {
  if (!metadata || typeof metadata !== "object") return {};
  const raw = metadata.attributes;
  if (!raw || typeof raw !== "object") return {};
  const parsed = businessAttributesSchema.safeParse(raw);
  return parsed.success ? parsed.data : {};
}
