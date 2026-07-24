import "server-only";
import { notFound, redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import {
  AuthRequiredError,
  ForbiddenError,
} from "@/lib/auth/require-admin";
import { requireBusinessMember } from "@/lib/auth/require-business-member";
import { createAdminClient } from "@/lib/supabase/admin";
import { businessProfileService } from "@/services/business-portal/business-profile.service";
import { businessSpecialService } from "@/services/business-portal/business-special.service";
import { businessMenuItemService } from "@/services/business-portal/business-menu-item.service";
import { businessGalleryService } from "@/services/business-portal/business-gallery.service";
import { publicMediaUrl } from "@/services/business-portal/business-media.service";
import { isSpecialLive } from "@/lib/business-portal/special-live";
import type {
  BusinessMemberRow,
  BusinessMenuItemRow,
  BusinessProfileRow,
  BusinessSpecialRow,
} from "@/types/database";
import type { BusinessPhoto as SchemaPhoto } from "@/lib/schemas/business";

export type PortalBusiness = {
  id: string;
  name: string;
  category: string | null;
  categories: string[];
  /** Merged (owner override || Google). */
  description: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  /** Raw Google values for the editor. */
  directoryDescription: string | null;
  directoryPhone: string | null;
  directoryWebsite: string | null;
  city_slug: string;
  rating: number | null;
  rating_count: number | null;
  price_level: number | null;
  lat: number | null;
  lng: number | null;
  photos: SchemaPhoto[];
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  profile: BusinessProfileRow | null;
  logoUrl: string | null;
  heroUrl: string | null;
  specials: BusinessSpecialRow[];
  activeSpecialCount: number;
  menuItemCount: number;
  menuItemsWithImages: number;
  galleryCount: number;
};

export type PortalAccess = {
  user: User;
  membership: BusinessMemberRow;
  business: PortalBusiness;
};

export async function requirePortalBusiness(
  businessId: string,
): Promise<PortalAccess> {
  let access;
  try {
    access = await requireBusinessMember(businessId);
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      redirect(
        `/?auth=signin&next=${encodeURIComponent(`/business/dashboard/${businessId}`)}`,
      );
    }
    if (error instanceof ForbiddenError) {
      redirect("/business/dashboard");
    }
    throw error;
  }

  const business = await loadPortalBusiness(businessId);
  if (!business) notFound();

  return {
    user: access.user,
    membership: access.membership,
    business,
  };
}

export async function loadPortalBusiness(
  businessId: string,
): Promise<PortalBusiness | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("businesses")
    .select(
      "id, name, category, categories, description, address, phone, website, city_slug, rating, rating_count, price_level, lat, lng, photos, metadata, created_at, updated_at",
    )
    .eq("id", businessId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load business: ${error.message}`);
  if (!data) return null;

  const [profile, specials, menuItems, gallery] = await Promise.all([
    businessProfileService.get(businessId),
    businessSpecialService.listForBusiness(businessId),
    businessMenuItemService.list(businessId),
    businessGalleryService.list(businessId),
  ]);

  const now = new Date();
  const activeSpecialCount = specials.filter((s) =>
    isSpecialLive(s, now),
  ).length;

  return {
    ...data,
    categories: data.categories ?? [],
    directoryDescription: data.description,
    directoryPhone: data.phone,
    directoryWebsite: data.website,
    description: profile?.description?.trim() || data.description,
    phone: profile?.phone?.trim() || data.phone,
    website: profile?.website?.trim() || data.website,
    photos: normalizePhotos(data.photos),
    metadata: (data.metadata as Record<string, unknown>) ?? {},
    profile,
    logoUrl: publicMediaUrl(profile?.logo_path),
    heroUrl: publicMediaUrl(profile?.hero_path),
    specials,
    activeSpecialCount,
    menuItemCount: menuItems.length,
    menuItemsWithImages: menuItems.filter((m: BusinessMenuItemRow) =>
      Boolean(m.image_path),
    ).length,
    galleryCount: gallery.length,
  };
}

function normalizePhotos(raw: unknown): SchemaPhoto[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((p): p is SchemaPhoto => {
    if (typeof p !== "object" || p == null) return false;
    const url = (p as { url?: unknown }).url;
    return typeof url === "string" && url.length > 0;
  });
}

export function listingCompleteness(business: PortalBusiness): {
  score: number;
  checks: { id: string; label: string; done: boolean }[];
} {
  const hours = business.metadata.openingHours as
    | { weekdayDescriptions?: string[] }
    | undefined;
  const directoryServices = business.metadata.services;
  const ownerServices = business.profile?.services ?? [];
  const hasServices =
    ownerServices.length > 0 ||
    (Array.isArray(directoryServices) && directoryServices.length > 0);
  const hasHoursOverride = Boolean(
    business.profile?.hours_override &&
      typeof business.profile.hours_override === "object",
  );
  const checks = [
    {
      id: "description",
      label: "Description",
      done: Boolean(business.description?.trim()),
    },
    {
      id: "phone",
      label: "Phone number",
      done: Boolean(business.phone?.trim()),
    },
    {
      id: "website",
      label: "Website",
      done: Boolean(business.website?.trim()),
    },
    {
      id: "address",
      label: "Address",
      done: Boolean(business.address?.trim()),
    },
    {
      id: "logo",
      label: "Logo uploaded",
      done: Boolean(business.logoUrl),
    },
    {
      id: "hero",
      label: "Hero image uploaded",
      done: Boolean(business.heroUrl),
    },
    {
      id: "gallery",
      label: "Gallery photos",
      done: business.galleryCount > 0,
    },
    {
      id: "photos",
      label: "Directory photos",
      done: business.photos.length > 0,
    },
    {
      id: "hours",
      label: "Opening hours",
      done:
        hasHoursOverride || Boolean(hours?.weekdayDescriptions?.length),
    },
    {
      id: "services",
      label: "Services listed",
      done: hasServices,
    },
    {
      id: "menu",
      label: "Menu / service options",
      done: business.menuItemCount > 0,
    },
    {
      id: "menu-images",
      label: "Menu item photos",
      done: business.menuItemsWithImages > 0,
    },
    {
      id: "special",
      label: "At least one live special",
      done: business.activeSpecialCount > 0,
    },
  ];
  const doneCount = checks.filter((c) => c.done).length;
  return {
    score: Math.round((doneCount / checks.length) * 100),
    checks,
  };
}
