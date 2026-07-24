"use server";

import { z } from "zod";
import { businessSearchService } from "@/services/ai/business-search.service";
import type { BusinessResult } from "@/lib/schemas/business";

export async function getBusinessByIdAction(input: {
  id: string;
  citySlug: string;
}): Promise<{ ok: true; data: BusinessResult } | { ok: false; error: string }> {
  const parsed = z
    .object({
      id: z.string().uuid(),
      citySlug: z.string().min(1).max(64),
    })
    .safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: "Invalid business" };
  }

  try {
    const business = await businessSearchService.getById(parsed.data);
    if (!business) return { ok: false, error: "Business not found" };
    return { ok: true, data: business };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load business";
    return { ok: false, error: message };
  }
}
