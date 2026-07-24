"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin, requireUser } from "@/lib/auth/require-admin";
import { requireBusinessMember } from "@/lib/auth/require-business-member";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  approveAndIngestBusinessClaimSchema,
  approveBusinessClaimSchema,
  ingestBusinessForSearchSchema,
  rejectBusinessClaimSchema,
  searchBusinessClaimSchema,
  submitBusinessClaimSchema,
} from "@/lib/schemas/business-claim";
import { updateBusinessListingSchema } from "@/lib/schemas/business-profile";
import {
  bulkCreateMenuItemsSchema,
  createBusinessMenuItemSchema,
  deleteBusinessMenuItemSchema,
  reorderBusinessMenuItemsSchema,
  updateBusinessMenuItemSchema,
  updateBusinessServicesKeywordsSchema,
} from "@/lib/schemas/business-offerings";
import {
  archiveBusinessSpecialSchema,
  createBusinessSpecialSchema,
  deleteBusinessSpecialSchema,
  duplicateBusinessSpecialSchema,
  updateBusinessSpecialSchema,
} from "@/lib/schemas/business-special";
import {
  BusinessClaimError,
  businessClaimService,
} from "@/services/business-portal/business-claim.service";
import { businessProfileService } from "@/services/business-portal/business-profile.service";
import { businessSpecialService } from "@/services/business-portal/business-special.service";
import { businessMenuItemService } from "@/services/business-portal/business-menu-item.service";
import { businessGalleryService } from "@/services/business-portal/business-gallery.service";
import { businessInviteService } from "@/services/business-portal/business-invite.service";
import { businessMemberService } from "@/services/business-portal/business-member.service";
import { menuImportService } from "@/services/business-portal/menu-import.service";
import { offeringsStudyService } from "@/services/business-portal/offerings-study.service";
import { businessSearchIngestService } from "@/services/business-portal/business-search-ingest.service";
import type { SearchIngestResult } from "@/services/business-portal/business-search-ingest.service";
import {
  businessMediaService,
  publicMediaUrl,
} from "@/services/business-portal/business-media.service";
import { parseRecurrence } from "@/lib/business-portal/special-live";
import { analyseOfferingsForSearchSchema } from "@/lib/schemas/offerings-study";
import type { OfferingsStudySuggestion } from "@/lib/schemas/offerings-study";
import {
  checkMenuImportBusinessRateLimit,
  checkMenuImportUserRateLimit,
  isRateLimitConfigured,
} from "@/lib/security/rate-limit";
import { captureAbuseEvent } from "@/lib/security/abuse-events";
import { detectFileType } from "@/lib/security/detect-file-type";
import { env } from "@/lib/env";
import type { BusinessResult } from "@/lib/schemas/business";
import type { BusinessMenuItemInput } from "@/lib/schemas/business-offerings";
import type {
  BusinessSpecialKind,
  BusinessSpecialScheduleType,
  Json,
} from "@/types/database";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function searchBusinessesForClaimAction(input: {
  query: string;
  citySlug: string;
}): Promise<ActionResult<BusinessResult[]>> {
  try {
    await requireUser();
    const parsed = searchBusinessClaimSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid search",
      };
    }

    const results = await businessClaimService.searchForClaim({
      query: parsed.data.query,
      citySlug: parsed.data.citySlug,
    });
    return { ok: true, data: results };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Search failed";
    return { ok: false, error: message };
  }
}

export async function submitBusinessClaimAction(input: unknown): Promise<
  ActionResult<{ claimId: string; citySlug: string }>
> {
  try {
    const user = await requireUser();
    const parsed = submitBusinessClaimSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid claim",
      };
    }

    const claim = await businessClaimService.submitClaim(user.id, parsed.data);
    return {
      ok: true,
      data: { claimId: claim.id, citySlug: parsed.data.citySlug },
    };
  } catch (error) {
    if (error instanceof BusinessClaimError) {
      return { ok: false, error: error.message };
    }
    const message =
      error instanceof Error ? error.message : "Failed to submit claim";
    return { ok: false, error: message };
  }
}

export async function submitBusinessClaimAndRedirect(
  input: unknown,
): Promise<ActionResult<{ claimId: string }>> {
  const result = await submitBusinessClaimAction(input);
  if (!result.ok) return result;

  redirect(
    `/${result.data.citySlug}/business/claim/success?claimId=${result.data.claimId}`,
  );
}

export async function approveBusinessClaimAction(
  claimId: string,
): Promise<ActionResult> {
  try {
    const { user } = await requireAdmin();
    const parsed = approveBusinessClaimSchema.safeParse({ claimId });
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid claim id",
      };
    }

    await businessClaimService.approveClaim(parsed.data.claimId, user.id);
    return { ok: true, data: undefined };
  } catch (error) {
    if (error instanceof BusinessClaimError) {
      return { ok: false, error: error.message };
    }
    const message =
      error instanceof Error ? error.message : "Failed to approve claim";
    return { ok: false, error: message };
  }
}

/**
 * One-time search ingest for a listing (Places enrich + offerings study + embed).
 * Use after/with claim approval. Later owner updates restudy on a 48h batch.
 */
export async function ingestBusinessForSearchAction(
  input: unknown,
): Promise<ActionResult<SearchIngestResult>> {
  try {
    const { user } = await requireAdmin();
    const parsed = ingestBusinessForSearchSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid business",
      };
    }

    const result = await businessSearchIngestService.ingestBusiness(
      parsed.data.businessId,
      { force: parsed.data.force, actorUserId: user.id },
    );
    return { ok: true, data: result };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Ingest failed";
    return { ok: false, error: message };
  }
}

/** Approve claim then run one-time search ingest. */
export async function approveAndIngestBusinessClaimAction(
  input: unknown,
): Promise<ActionResult<SearchIngestResult>> {
  try {
    const { user } = await requireAdmin();
    const parsed = approveAndIngestBusinessClaimSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid claim",
      };
    }

    const claim = await businessClaimService.approveClaim(
      parsed.data.claimId,
      user.id,
    );
    const result = await businessSearchIngestService.ingestBusiness(
      claim.business_id,
      { force: parsed.data.forceIngest, actorUserId: user.id },
    );
    return { ok: true, data: result };
  } catch (error) {
    if (error instanceof BusinessClaimError) {
      return { ok: false, error: error.message };
    }
    const message =
      error instanceof Error ? error.message : "Approve & ingest failed";
    return { ok: false, error: message };
  }
}

export async function rejectBusinessClaimAction(input: {
  claimId: string;
  reason: string;
}): Promise<ActionResult> {
  try {
    const { user } = await requireAdmin();
    const parsed = rejectBusinessClaimSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid rejection",
      };
    }

    await businessClaimService.rejectClaim(
      parsed.data.claimId,
      user.id,
      parsed.data.reason,
    );
    return { ok: true, data: undefined };
  } catch (error) {
    if (error instanceof BusinessClaimError) {
      return { ok: false, error: error.message };
    }
    const message =
      error instanceof Error ? error.message : "Failed to reject claim";
    return { ok: false, error: message };
  }
}

export async function updateBusinessOwnerProfileAction(input: {
  fullName: string;
}): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const parsed = z
      .object({
        fullName: z.string().trim().min(1).max(120),
      })
      .safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid name",
      };
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from("profiles")
      .update({ full_name: parsed.data.fullName })
      .eq("id", user.id);

    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true, data: undefined };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update profile";
    return { ok: false, error: message };
  }
}

function toIsoOrNull(value?: string): string | null {
  if (!value?.trim()) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function parseSpecialFormData(formData: FormData) {
  const scheduleType = String(formData.get("scheduleType") ?? "one_time");
  const daysRaw = String(formData.get("daysOfWeek") ?? "");
  const daysOfWeek = daysRaw
    .split(",")
    .map((d) => Number(d.trim()))
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);

  const recurrence =
    scheduleType === "recurring"
      ? {
          frequency: "weekly" as const,
          daysOfWeek,
          startTime: String(formData.get("startTime") ?? "17:00"),
          endTime: String(formData.get("endTime") ?? "19:00"),
          timezone: String(
            formData.get("timezone") ?? "Africa/Johannesburg",
          ),
        }
      : null;

  return {
    businessId: String(formData.get("businessId") ?? ""),
    specialId: String(formData.get("specialId") ?? "") || undefined,
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    status: String(formData.get("status") ?? "draft"),
    kind: String(formData.get("kind") ?? "deal"),
    discountLabel: String(formData.get("discountLabel") ?? ""),
    terms: String(formData.get("terms") ?? ""),
    ctaUrl: String(formData.get("ctaUrl") ?? ""),
    scheduleType,
    startsAt: String(formData.get("startsAt") ?? ""),
    endsAt: String(formData.get("endsAt") ?? ""),
    validFrom: String(formData.get("validFrom") ?? ""),
    validUntil: String(formData.get("validUntil") ?? ""),
    recurrence,
    clearImage: String(formData.get("clearImage") ?? "") === "true",
  };
}

export async function updateBusinessListingAction(input: unknown): Promise<ActionResult> {
  try {
    const parsed = updateBusinessListingSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid listing",
      };
    }
    const { user } = await requireBusinessMember(parsed.data.businessId);
    await businessProfileService.updateListing(parsed.data.businessId, user.id, {
      tagline: parsed.data.tagline ?? "",
      description: parsed.data.description ?? "",
      phone: parsed.data.phone ?? "",
      website: parsed.data.website ?? "",
      hoursOverride: parsed.data.hoursOverride ?? null,
      attributes: parsed.data.attributes,
      listingVertical: parsed.data.listingVertical ?? null,
    });
    return { ok: true, data: undefined };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update listing";
    return { ok: false, error: message };
  }
}

export async function updateBusinessServicesKeywordsAction(
  input: unknown,
): Promise<ActionResult> {
  try {
    const parsed = updateBusinessServicesKeywordsSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid services",
      };
    }
    const { user } = await requireBusinessMember(parsed.data.businessId);
    await businessProfileService.updateServicesKeywords(
      parsed.data.businessId,
      user.id,
      {
        services: parsed.data.services,
        keywords: parsed.data.keywords,
      },
    );
    return { ok: true, data: undefined };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update services";
    return { ok: false, error: message };
  }
}

export async function createMenuItemAction(
  input: unknown,
): Promise<ActionResult<{ itemId: string }>> {
  try {
    const parsed = createBusinessMenuItemSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid item",
      };
    }
    await requireBusinessMember(parsed.data.businessId);
    const row = await businessMenuItemService.create(parsed.data.businessId, parsed.data);
    return { ok: true, data: { itemId: row.id } };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create item";
    return { ok: false, error: message };
  }
}

export async function updateMenuItemAction(input: unknown): Promise<ActionResult> {
  try {
    const parsed = updateBusinessMenuItemSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid item",
      };
    }
    await requireBusinessMember(parsed.data.businessId);
    await businessMenuItemService.update(
      parsed.data.businessId,
      parsed.data.itemId,
      parsed.data,
    );
    return { ok: true, data: undefined };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update item";
    return { ok: false, error: message };
  }
}

export async function deleteMenuItemAction(input: unknown): Promise<ActionResult> {
  try {
    const parsed = deleteBusinessMenuItemSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid request",
      };
    }
    await requireBusinessMember(parsed.data.businessId);
    await businessMenuItemService.delete(
      parsed.data.businessId,
      parsed.data.itemId,
    );
    return { ok: true, data: undefined };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete item";
    return { ok: false, error: message };
  }
}

export async function reorderMenuItemsAction(input: unknown): Promise<ActionResult> {
  try {
    const parsed = reorderBusinessMenuItemsSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid order",
      };
    }
    await requireBusinessMember(parsed.data.businessId);
    await businessMenuItemService.reorder(
      parsed.data.businessId,
      parsed.data.orderedIds,
    );
    return { ok: true, data: undefined };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to reorder";
    return { ok: false, error: message };
  }
}

export async function bulkCreateMenuItemsAction(
  input: unknown,
): Promise<ActionResult<{ count: number }>> {
  try {
    const parsed = bulkCreateMenuItemsSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid items",
      };
    }
    await requireBusinessMember(parsed.data.businessId);
    const rows = await businessMenuItemService.createMany(
      parsed.data.businessId,
      parsed.data.items,
    );
    return { ok: true, data: { count: rows.length } };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to import items";
    return { ok: false, error: message };
  }
}

export async function uploadMenuItemImageAction(
  formData: FormData,
): Promise<ActionResult<{ url: string }>> {
  try {
    const businessId = String(formData.get("businessId") ?? "");
    const itemId = String(formData.get("itemId") ?? "");
    const file = formData.get("file");
    if (!z.string().uuid().safeParse(businessId).success) {
      return { ok: false, error: "Invalid business" };
    }
    if (!z.string().uuid().safeParse(itemId).success) {
      return { ok: false, error: "Invalid item" };
    }
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, error: "Choose an image" };
    }
    await requireBusinessMember(businessId);
    const path = await businessMediaService.upload({
      businessId,
      kind: "menu_item",
      file,
      menuItemId: itemId,
    });
    await businessMenuItemService.setImage(businessId, itemId, path);
    const url = publicMediaUrl(path);
    if (!url) return { ok: false, error: "Failed to build URL" };
    return { ok: true, data: { url } };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Upload failed";
    return { ok: false, error: message };
  }
}

export async function clearMenuItemImageAction(input: {
  businessId: string;
  itemId: string;
}): Promise<ActionResult> {
  try {
    await requireBusinessMember(input.businessId);
    await businessMenuItemService.clearImage(input.businessId, input.itemId);
    return { ok: true, data: undefined };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to clear image";
    return { ok: false, error: message };
  }
}

export async function extractMenuFromFileAction(
  formData: FormData,
): Promise<
  ActionResult<{
    items: BusinessMenuItemInput[];
    suggestions: OfferingsStudySuggestion;
  }>
> {
  try {
    const businessId = String(formData.get("businessId") ?? "");
    const file = formData.get("file");
    if (!z.string().uuid().safeParse(businessId).success) {
      return { ok: false, error: "Invalid business" };
    }
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, error: "Choose a menu photo or PDF" };
    }
    const { user } = await requireBusinessMember(businessId);

    if (env.NODE_ENV === "production" && !isRateLimitConfigured()) {
      return {
        ok: false,
        error: "Menu import is temporarily unavailable. Please try again later.",
      };
    }

    const byUser = await checkMenuImportUserRateLimit(user.id);
    const byBiz = await checkMenuImportBusinessRateLimit(businessId);
    if (
      (!byUser.configured || !byBiz.configured) &&
      env.NODE_ENV === "production"
    ) {
      return {
        ok: false,
        error: "Menu import is temporarily unavailable. Please try again later.",
      };
    }
    if (!byUser.success || !byBiz.success) {
      captureAbuseEvent({
        event: "menu_import_rate_limited",
        distinctId: user.id,
        properties: {
          businessId,
          scope: !byUser.success ? "user_hourly" : "business_daily",
        },
      });
      return {
        ok: false,
        error: "Too many menu imports. Please wait and try again.",
      };
    }

    const ctx = await loadOfferingsStudyContext(businessId);
    const bytes = Buffer.from(await file.arrayBuffer());
    const mime = detectFileType(bytes);
    if (!mime) {
      return {
        ok: false,
        error: "Only JPEG, PNG, WebP, or PDF menu files are allowed",
      };
    }

    let items: BusinessMenuItemInput[];
    if (mime === "application/pdf") {
      items = await menuImportService.extractFromPdfBuffer({
        bytes,
        businessName: ctx.businessName,
      });
    } else {
      items = await menuImportService.extractFromImage({
        bytes,
        mimeType: mime,
        businessName: ctx.businessName,
      });
    }

    if (items.length === 0) {
      return {
        ok: false,
        error: "No menu items found. Try a clearer photo or use bulk paste.",
      };
    }

    let suggestions: OfferingsStudySuggestion = {
      services: [],
      keywords: [],
      summary: null,
    };
    try {
      suggestions = await offeringsStudyService.study({
        businessName: ctx.businessName,
        category: ctx.category,
        verticals: ctx.verticals,
        items,
        existingServices: ctx.services,
        existingKeywords: ctx.keywords,
      });
    } catch {
      // Items still usable if study fails.
    }

    return { ok: true, data: { items, suggestions } };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Import failed";
    return { ok: false, error: message };
  }
}

/**
 * Study saved menu items (or a draft list) and suggest services/keywords
 * for search matching. Owner must still save chips explicitly.
 */
export async function analyseOfferingsForSearchAction(
  input: unknown,
): Promise<ActionResult<OfferingsStudySuggestion>> {
  try {
    const parsed = analyseOfferingsForSearchSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid request",
      };
    }
    const { businessId } = parsed.data;
    await requireBusinessMember(businessId);

    if (env.NODE_ENV === "production" && !isRateLimitConfigured()) {
      return {
        ok: false,
        error: "Analysis is temporarily unavailable. Please try again later.",
      };
    }

    const ctx = await loadOfferingsStudyContext(businessId);
    let items = parsed.data.items;
    if (!items?.length) {
      const rows = await businessMenuItemService.list(businessId);
      items = rows.map((r) => ({
        name: r.name,
        description: r.description ?? "",
        price: r.price ?? "",
        category: r.category ?? "",
      }));
    }
    if (!items.length) {
      return {
        ok: false,
        error: "Add menu or service options first, then analyse.",
      };
    }

    const suggestions = await offeringsStudyService.study({
      businessName: ctx.businessName,
      category: ctx.category,
      verticals: ctx.verticals,
      items,
      existingServices: ctx.services,
      existingKeywords: ctx.keywords,
    });

    if (
      suggestions.services.length === 0 &&
      suggestions.keywords.length === 0
    ) {
      return {
        ok: false,
        error: "Could not find searchable terms in those offerings yet.",
      };
    }

    return { ok: true, data: suggestions };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Analysis failed";
    return { ok: false, error: message };
  }
}

async function loadOfferingsStudyContext(businessId: string): Promise<{
  businessName: string;
  category: string | null;
  verticals: string[];
  services: string[];
  keywords: string[];
}> {
  const admin = createAdminClient();
  const [{ data: business }, profile] = await Promise.all([
    admin
      .from("businesses")
      .select("name, category, metadata")
      .eq("id", businessId)
      .maybeSingle(),
    businessProfileService.get(businessId),
  ]);

  const metadata =
    business?.metadata && typeof business.metadata === "object"
      ? (business.metadata as Record<string, unknown>)
      : {};
  const verticals = Array.isArray(metadata.verticals)
    ? metadata.verticals.filter((v): v is string => typeof v === "string")
    : [];

  return {
    businessName: business?.name ?? "Business",
    category: business?.category ?? null,
    verticals,
    services: profile?.services ?? [],
    keywords: profile?.keywords ?? [],
  };
}

export async function uploadBusinessBrandingAction(
  formData: FormData,
): Promise<ActionResult<{ path: string; url: string }>> {
  try {
    const businessId = String(formData.get("businessId") ?? "");
    const kind = String(formData.get("kind") ?? "");
    const file = formData.get("file");

    if (!z.string().uuid().safeParse(businessId).success) {
      return { ok: false, error: "Invalid business" };
    }
    if (kind !== "logo" && kind !== "hero") {
      return { ok: false, error: "Invalid media kind" };
    }
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, error: "Choose an image to upload" };
    }

    const { user } = await requireBusinessMember(businessId);
    const path = await businessMediaService.upload({
      businessId,
      kind,
      file,
    });
    await businessProfileService.setMediaPath(businessId, user.id, kind, path);
    const url = publicMediaUrl(path);
    if (!url) return { ok: false, error: "Failed to build media URL" };
    return { ok: true, data: { path, url } };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Upload failed";
    return { ok: false, error: message };
  }
}

export async function clearBusinessBrandingAction(input: {
  businessId: string;
  kind: "logo" | "hero";
}): Promise<ActionResult> {
  try {
    if (!z.string().uuid().safeParse(input.businessId).success) {
      return { ok: false, error: "Invalid business" };
    }
    const { user } = await requireBusinessMember(input.businessId);
    await businessProfileService.clearMediaPath(
      input.businessId,
      user.id,
      input.kind,
    );
    return { ok: true, data: undefined };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to remove image";
    return { ok: false, error: message };
  }
}

export async function uploadGalleryImageAction(
  formData: FormData,
): Promise<ActionResult<{ id: string; url: string }>> {
  try {
    const businessId = String(formData.get("businessId") ?? "");
    const caption = String(formData.get("caption") ?? "");
    const file = formData.get("file");
    if (!z.string().uuid().safeParse(businessId).success) {
      return { ok: false, error: "Invalid business" };
    }
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, error: "Choose an image" };
    }
    await requireBusinessMember(businessId);
    const path = await businessMediaService.upload({
      businessId,
      kind: "gallery",
      file,
    });
    const row = await businessGalleryService.add(businessId, path, caption);
    const url = publicMediaUrl(path);
    if (!url) return { ok: false, error: "Failed to build URL" };
    return { ok: true, data: { id: row.id, url } };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Upload failed";
    return { ok: false, error: message };
  }
}

export async function deleteGalleryImageAction(input: {
  businessId: string;
  imageId: string;
}): Promise<ActionResult> {
  try {
    await requireBusinessMember(input.businessId);
    await businessGalleryService.delete(input.businessId, input.imageId);
    return { ok: true, data: undefined };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete image";
    return { ok: false, error: message };
  }
}

export async function createBusinessSpecialAction(
  formData: FormData,
): Promise<ActionResult<{ specialId: string }>> {
  try {
    const raw = parseSpecialFormData(formData);
    const parsed = createBusinessSpecialSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid special",
      };
    }

    const { user } = await requireBusinessMember(parsed.data.businessId);
    const file = formData.get("image");
    let imagePath: string | null = null;
    if (file instanceof File && file.size > 0) {
      imagePath = await businessMediaService.upload({
        businessId: parsed.data.businessId,
        kind: "special",
        file,
      });
    }

    const special = await businessSpecialService.create(user.id, {
      businessId: parsed.data.businessId,
      title: parsed.data.title,
      description: parsed.data.description,
      status: parsed.data.status,
      kind: parsed.data.kind as BusinessSpecialKind,
      discountLabel: parsed.data.discountLabel,
      terms: parsed.data.terms,
      ctaUrl: parsed.data.ctaUrl,
      scheduleType: parsed.data.scheduleType as BusinessSpecialScheduleType,
      startsAt: toIsoOrNull(parsed.data.startsAt),
      endsAt: toIsoOrNull(parsed.data.endsAt),
      validFrom: toIsoOrNull(parsed.data.validFrom),
      validUntil: toIsoOrNull(parsed.data.validUntil),
      recurrence: parsed.data.recurrence
        ? parseRecurrence(parsed.data.recurrence as Json)
        : null,
      imagePath,
    });
    return { ok: true, data: { specialId: special.id } };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create special";
    return { ok: false, error: message };
  }
}

export async function updateBusinessSpecialAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const raw = parseSpecialFormData(formData);
    const parsed = updateBusinessSpecialSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid special",
      };
    }

    await requireBusinessMember(parsed.data.businessId);
    const file = formData.get("image");
    let imagePath: string | null | undefined;
    if (file instanceof File && file.size > 0) {
      imagePath = await businessMediaService.upload({
        businessId: parsed.data.businessId,
        kind: "special",
        file,
        specialId: parsed.data.specialId,
      });
    }

    await businessSpecialService.update(parsed.data.specialId, {
      businessId: parsed.data.businessId,
      title: parsed.data.title,
      description: parsed.data.description,
      status: parsed.data.status,
      kind: parsed.data.kind as BusinessSpecialKind,
      discountLabel: parsed.data.discountLabel,
      terms: parsed.data.terms,
      ctaUrl: parsed.data.ctaUrl,
      scheduleType: parsed.data.scheduleType as BusinessSpecialScheduleType,
      startsAt: toIsoOrNull(parsed.data.startsAt),
      endsAt: toIsoOrNull(parsed.data.endsAt),
      validFrom: toIsoOrNull(parsed.data.validFrom),
      validUntil: toIsoOrNull(parsed.data.validUntil),
      recurrence: parsed.data.recurrence
        ? parseRecurrence(parsed.data.recurrence as Json)
        : null,
      imagePath,
      clearImage: parsed.data.clearImage,
    });
    return { ok: true, data: undefined };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update special";
    return { ok: false, error: message };
  }
}

export async function archiveBusinessSpecialAction(input: {
  businessId: string;
  specialId: string;
}): Promise<ActionResult> {
  try {
    const parsed = archiveBusinessSpecialSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid request",
      };
    }
    await requireBusinessMember(parsed.data.businessId);
    await businessSpecialService.archive(
      parsed.data.specialId,
      parsed.data.businessId,
    );
    return { ok: true, data: undefined };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to archive special";
    return { ok: false, error: message };
  }
}

export async function deleteBusinessSpecialAction(input: {
  businessId: string;
  specialId: string;
}): Promise<ActionResult> {
  try {
    const parsed = deleteBusinessSpecialSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid request",
      };
    }
    await requireBusinessMember(parsed.data.businessId);
    await businessSpecialService.delete(
      parsed.data.specialId,
      parsed.data.businessId,
    );
    return { ok: true, data: undefined };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete special";
    return { ok: false, error: message };
  }
}

export async function duplicateBusinessSpecialAction(input: {
  businessId: string;
  specialId: string;
}): Promise<ActionResult<{ specialId: string }>> {
  try {
    const parsed = duplicateBusinessSpecialSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid request",
      };
    }
    const { user } = await requireBusinessMember(parsed.data.businessId);
    const copy = await businessSpecialService.duplicate(
      parsed.data.specialId,
      parsed.data.businessId,
      user.id,
    );
    return { ok: true, data: { specialId: copy.id } };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to duplicate";
    return { ok: false, error: message };
  }
}

export async function inviteBusinessManagerAction(input: {
  businessId: string;
  email: string;
}): Promise<ActionResult<{ acceptPath: string; token: string }>> {
  try {
    const parsed = z
      .object({
        businessId: z.string().uuid(),
        email: z.string().trim().email(),
      })
      .safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid invite",
      };
    }
    const { user } = await requireBusinessMember(parsed.data.businessId, "owner");
    const { invite, acceptPath } = await businessInviteService.create({
      businessId: parsed.data.businessId,
      email: parsed.data.email,
      invitedBy: user.id,
    });
    return {
      ok: true,
      data: { acceptPath, token: invite.token },
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to invite";
    return { ok: false, error: message };
  }
}

export async function revokeBusinessInviteAction(input: {
  businessId: string;
  inviteId: string;
}): Promise<ActionResult> {
  try {
    await requireBusinessMember(input.businessId, "owner");
    await businessInviteService.revoke(input.businessId, input.inviteId);
    return { ok: true, data: undefined };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to revoke invite";
    return { ok: false, error: message };
  }
}

export async function acceptBusinessInviteAction(input: {
  token: string;
}): Promise<ActionResult<{ businessId: string }>> {
  try {
    const user = await requireUser();
    const membership = await businessInviteService.accept({
      token: input.token,
      userId: user.id,
      userEmail: user.email,
    });
    return { ok: true, data: { businessId: membership.business_id } };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to accept invite";
    return { ok: false, error: message };
  }
}

export async function deactivateBusinessMemberAction(input: {
  businessId: string;
  memberId: string;
}): Promise<ActionResult> {
  try {
    const { user } = await requireBusinessMember(input.businessId, "owner");
    await businessMemberService.deactivateMember(
      input.businessId,
      input.memberId,
      user.id,
    );
    return { ok: true, data: undefined };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to deactivate";
    return { ok: false, error: message };
  }
}

export async function leaveBusinessAction(input: {
  businessId: string;
}): Promise<ActionResult> {
  try {
    const { user } = await requireBusinessMember(input.businessId);
    await businessMemberService.leaveBusiness(input.businessId, user.id);
    return { ok: true, data: undefined };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to leave business";
    return { ok: false, error: message };
  }
}

export async function updateBusinessNotificationsAction(input: {
  businessId: string;
  notifySpecialReminders: boolean;
  notifyTeamUpdates: boolean;
}): Promise<ActionResult> {
  try {
    const { user } = await requireBusinessMember(input.businessId);
    await businessProfileService.updateNotifications(input.businessId, user.id, {
      notifySpecialReminders: input.notifySpecialReminders,
      notifyTeamUpdates: input.notifyTeamUpdates,
    });
    return { ok: true, data: undefined };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save preferences";
    return { ok: false, error: message };
  }
}

export async function updateOwnerProfileAction(input: {
  fullName: string;
  phone?: string;
  notifyClaimUpdates?: boolean;
}): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const parsed = z
      .object({
        fullName: z.string().trim().min(1).max(120),
        phone: z.string().trim().max(40).optional().or(z.literal("")),
        notifyClaimUpdates: z.boolean().optional(),
      })
      .safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid profile",
      };
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from("profiles")
      .update({
        full_name: parsed.data.fullName,
        phone: parsed.data.phone?.trim() || null,
        ...(parsed.data.notifyClaimUpdates !== undefined
          ? { notify_claim_updates: parsed.data.notifyClaimUpdates }
          : {}),
      })
      .eq("id", user.id);

    if (error) return { ok: false, error: error.message };
    return { ok: true, data: undefined };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update profile";
    return { ok: false, error: message };
  }
}
