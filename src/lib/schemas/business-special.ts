import { z } from "zod";

export const businessSpecialStatusSchema = z.enum([
  "draft",
  "active",
  "archived",
]);

export const businessSpecialKindSchema = z.enum([
  "deal",
  "happy_hour",
  "event",
  "other",
]);

export const specialRecurrenceSchema = z.object({
  frequency: z.literal("weekly"),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  timezone: z.string().min(1).max(64).default("Africa/Johannesburg"),
});

export const createBusinessSpecialSchema = z
  .object({
    businessId: z.string().uuid(),
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().max(2000).optional().or(z.literal("")),
    status: businessSpecialStatusSchema.default("draft"),
    kind: businessSpecialKindSchema.default("deal"),
    discountLabel: z.string().trim().max(40).optional().or(z.literal("")),
    terms: z.string().trim().max(2000).optional().or(z.literal("")),
    ctaUrl: z.string().trim().max(500).optional().or(z.literal("")),
    scheduleType: z.enum(["one_time", "recurring"]).default("one_time"),
    startsAt: z.string().optional().or(z.literal("")),
    endsAt: z.string().optional().or(z.literal("")),
    validFrom: z.string().optional().or(z.literal("")),
    validUntil: z.string().optional().or(z.literal("")),
    recurrence: specialRecurrenceSchema.optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.scheduleType === "recurring") {
      if (!data.recurrence || data.recurrence.daysOfWeek.length === 0) {
        ctx.addIssue({
          code: "custom",
          message: "Pick at least one day for a recurring special",
          path: ["recurrence"],
        });
      }
    }
  });

export const updateBusinessSpecialSchema = createBusinessSpecialSchema.extend({
  specialId: z.string().uuid(),
  clearImage: z.boolean().optional(),
});

export const archiveBusinessSpecialSchema = z.object({
  businessId: z.string().uuid(),
  specialId: z.string().uuid(),
});

export const deleteBusinessSpecialSchema = archiveBusinessSpecialSchema;
export const duplicateBusinessSpecialSchema = archiveBusinessSpecialSchema;

export type CreateBusinessSpecialInput = z.infer<
  typeof createBusinessSpecialSchema
>;
export type UpdateBusinessSpecialInput = z.infer<
  typeof updateBusinessSpecialSchema
>;
