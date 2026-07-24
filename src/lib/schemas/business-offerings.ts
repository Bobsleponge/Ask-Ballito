import { z } from "zod";

export const businessMenuItemInputSchema = z.object({
  name: z.string().trim().min(1, "Item name is required").max(120),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  price: z.string().trim().max(40).optional().or(z.literal("")),
  category: z.string().trim().max(80).optional().or(z.literal("")),
});

export const createBusinessMenuItemSchema = businessMenuItemInputSchema.extend({
  businessId: z.string().uuid(),
});

export const updateBusinessMenuItemSchema = businessMenuItemInputSchema.extend({
  businessId: z.string().uuid(),
  itemId: z.string().uuid(),
});

export const deleteBusinessMenuItemSchema = z.object({
  businessId: z.string().uuid(),
  itemId: z.string().uuid(),
});

export const reorderBusinessMenuItemsSchema = z.object({
  businessId: z.string().uuid(),
  orderedIds: z.array(z.string().uuid()).max(80),
});

export const bulkCreateMenuItemsSchema = z.object({
  businessId: z.string().uuid(),
  items: z.array(businessMenuItemInputSchema).min(1).max(80),
});

export const updateBusinessServicesKeywordsSchema = z.object({
  businessId: z.string().uuid(),
  services: z.array(z.string().trim().min(1).max(80)).max(40),
  keywords: z.array(z.string().trim().min(1).max(60)).max(40),
});

export const extractedMenuItemSchema = businessMenuItemInputSchema;

export type BusinessMenuItemInput = z.infer<typeof businessMenuItemInputSchema>;
