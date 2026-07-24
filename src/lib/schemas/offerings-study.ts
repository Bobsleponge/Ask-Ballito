import { z } from "zod";
import { businessMenuItemInputSchema } from "@/lib/schemas/business-offerings";

/** Search-profile suggestions derived from owner offerings / menu. */
export const offeringsStudySuggestionSchema = z.object({
  services: z.array(z.string().trim().min(1).max(80)).max(40),
  keywords: z.array(z.string().trim().min(1).max(60)).max(40),
  /** One-line note for the owner UI. */
  summary: z.string().trim().max(280).nullable().optional(),
});

export const analyseOfferingsForSearchSchema = z.object({
  businessId: z.string().uuid(),
  /** Optional draft items (e.g. fresh import) — otherwise uses saved menu. */
  items: z.array(businessMenuItemInputSchema).max(80).optional(),
});

export type OfferingsStudySuggestion = z.infer<
  typeof offeringsStudySuggestionSchema
>;
