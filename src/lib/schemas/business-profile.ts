import { z } from "zod";
import { businessAttributesSchema } from "@/lib/schemas/business-attributes";

const weekdayHoursSchema = z.object({
  closed: z.boolean().optional(),
  open: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal("")),
  close: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal("")),
});

export const hoursOverrideSchema = z.object({
  monday: weekdayHoursSchema.optional(),
  tuesday: weekdayHoursSchema.optional(),
  wednesday: weekdayHoursSchema.optional(),
  thursday: weekdayHoursSchema.optional(),
  friday: weekdayHoursSchema.optional(),
  saturday: weekdayHoursSchema.optional(),
  sunday: weekdayHoursSchema.optional(),
});

export const updateBusinessListingSchema = z.object({
  businessId: z.string().uuid(),
  tagline: z.string().trim().max(160).optional().or(z.literal("")),
  description: z.string().trim().max(4000).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  website: z
    .string()
    .trim()
    .max(500)
    .optional()
    .or(z.literal(""))
    .refine(
      (v) => !v || v === "" || /^https?:\/\//i.test(v) || !v.includes(" "),
      "Website must be a valid URL",
    ),
  hoursOverride: hoursOverrideSchema.nullable().optional(),
  attributes: businessAttributesSchema.optional(),
  listingVertical: z.string().trim().max(64).nullable().optional(),
});

export type UpdateBusinessListingInput = z.infer<
  typeof updateBusinessListingSchema
>;
export type HoursOverride = z.infer<typeof hoursOverrideSchema>;
