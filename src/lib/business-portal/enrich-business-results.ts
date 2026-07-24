import "server-only";
import type {
  BusinessActiveSpecial,
  BusinessMenuItemResult,
  BusinessResult,
} from "@/lib/schemas/business";
import { createAdminClient } from "@/lib/supabase/admin";
import { businessProfileService } from "@/services/business-portal/business-profile.service";
import { businessSpecialService } from "@/services/business-portal/business-special.service";
import { businessMenuItemService } from "@/services/business-portal/business-menu-item.service";
import { businessGalleryService } from "@/services/business-portal/business-gallery.service";
import { publicMediaUrl } from "@/services/business-portal/business-media.service";
import type { HoursOverride } from "@/lib/schemas/business-profile";
import type {
  BusinessMenuItemRow,
  BusinessProfileRow,
  BusinessSpecialRow,
  Json,
} from "@/types/database";

/**
 * Merge owner branding + offerings + gallery + active specials onto results.
 * Also stamps portal match signals used by RankingEngine.
 */
export async function enrichBusinessResults(
  businesses: BusinessResult[],
): Promise<BusinessResult[]> {
  if (businesses.length === 0) return businesses;

  const ids = businesses.map((b) => b.id);
  const admin = createAdminClient();
  const [profiles, specials, menuItems, gallery, ingestRows, ownerRows] =
    await Promise.all([
      businessProfileService.getMany(ids),
      businessSpecialService.listActiveForBusinesses(ids),
      businessMenuItemService.listForBusinesses(ids),
      businessGalleryService.listForBusinesses(ids),
      admin
        .from("businesses")
        .select("id, search_ingested_at")
        .in("id", ids),
      admin
        .from("business_members")
        .select("business_id")
        .in("business_id", ids)
        .eq("status", "active")
        .eq("role", "owner"),
    ]);

  const profileById = new Map(profiles.map((p) => [p.business_id, p]));
  const ingestedById = new Map(
    (ingestRows.data ?? []).map((r) => [
      r.id as string,
      typeof r.search_ingested_at === "string",
    ]),
  );
  const claimedIds = new Set(
    (ownerRows.data ?? []).map((r) => r.business_id as string),
  );
  const specialsByBusiness = new Map<string, BusinessActiveSpecial[]>();
  for (const s of specials) {
    const list = specialsByBusiness.get(s.business_id) ?? [];
    list.push(toActiveSpecial(s));
    specialsByBusiness.set(s.business_id, list);
  }
  const menuByBusiness = new Map<string, BusinessMenuItemRow[]>();
  for (const m of menuItems) {
    const list = menuByBusiness.get(m.business_id) ?? [];
    list.push(m);
    menuByBusiness.set(m.business_id, list);
  }
  const galleryByBusiness = new Map<string, typeof gallery>();
  for (const g of gallery) {
    const list = galleryByBusiness.get(g.business_id) ?? [];
    list.push(g);
    galleryByBusiness.set(g.business_id, list);
  }

  return businesses.map((business) => {
    const profile = profileById.get(business.id);
    const logoUrl = publicMediaUrl(profile?.logo_path);
    const heroUrl = publicMediaUrl(profile?.hero_path);
    const activeSpecials = specialsByBusiness.get(business.id) ?? [];
    const ownerMenu = menuByBusiness.get(business.id) ?? [];
    const menuItemResults = ownerMenu.map(toMenuItemResult);
    const ownerGallery = galleryByBusiness.get(business.id) ?? [];
    const metadata = mergeOwnerMetadata(
      business.metadata,
      profile,
      menuItemResults,
      {
        portalClaimed: claimedIds.has(business.id),
        searchIngested: ingestedById.get(business.id) === true,
      },
    );

    const galleryPhotos = ownerGallery
      .map((g) => ({ url: publicMediaUrl(g.path)! }))
      .filter((p) => p.url);

    const photos = [
      ...(heroUrl ? [{ url: heroUrl }] : []),
      ...galleryPhotos,
      ...business.photos,
    ];

    const tagline = profile?.tagline?.trim() || null;
    const ownerDescription = profile?.description?.trim() || null;

    return {
      ...business,
      description:
        [tagline, ownerDescription].filter(Boolean).join(" — ") ||
        business.description,
      phone: profile?.phone?.trim() || business.phone,
      website: profile?.website?.trim() || business.website,
      logoUrl: logoUrl ?? undefined,
      heroUrl: heroUrl ?? undefined,
      activeSpecials: activeSpecials.length ? activeSpecials : undefined,
      menuItems: menuItemResults.length ? menuItemResults : undefined,
      metadata,
      photos,
    };
  });
}

function toActiveSpecial(s: BusinessSpecialRow): BusinessActiveSpecial {
  return {
    id: s.id,
    title: s.title,
    kind: s.kind,
    discountLabel: s.discount_label,
    terms: s.terms,
    ctaUrl: s.cta_url,
    imageUrl: publicMediaUrl(s.image_path),
  };
}

function toMenuItemResult(m: BusinessMenuItemRow): BusinessMenuItemResult {
  return {
    id: m.id,
    name: m.name,
    description: m.description,
    price: m.price,
    category: m.category,
    imageUrl: publicMediaUrl(m.image_path),
  };
}

function mergeOwnerMetadata(
  metadata: Record<string, unknown> | undefined,
  profile:
    | Pick<
        BusinessProfileRow,
        | "services"
        | "keywords"
        | "hours_override"
        | "attributes"
        | "tagline"
        | "description"
        | "phone"
        | "website"
      >
    | undefined,
  menuItems: BusinessMenuItemResult[],
  portalFlags: { portalClaimed: boolean; searchIngested: boolean },
): Record<string, unknown> | undefined {
  const base = { ...(metadata ?? {}) };
  base.portalClaimed = portalFlags.portalClaimed;
  base.searchIngested = portalFlags.searchIngested;

  if (!profile && menuItems.length === 0) {
    base.ownerProfileComplete = false;
    return base;
  }

  const ownerServices = profile?.services ?? [];
  const ownerKeywords = profile?.keywords ?? [];
  const metaServices = stringList(base.services);
  const metaKeywords = stringList(base.keywords);
  const menuNames = menuItems.map((m) => m.name).filter(Boolean);

  const services = uniqueStrings([
    ...ownerServices,
    ...menuNames,
    ...metaServices,
  ]);
  if (services.length) base.services = services;

  if (ownerKeywords.length || metaKeywords.length) {
    base.keywords = uniqueStrings([...ownerKeywords, ...metaKeywords]);
  }
  if (menuItems.length) {
    base.menuItems = menuItems;
  }
  if (profile?.tagline?.trim()) {
    base.tagline = profile.tagline.trim();
  }
  if (profile?.hours_override) {
    const weekdayDescriptions = hoursToDescriptions(profile.hours_override);
    if (weekdayDescriptions.length) {
      base.openingHours = {
        ...(typeof base.openingHours === "object" && base.openingHours
          ? (base.openingHours as object)
          : {}),
        weekdayDescriptions,
      };
    }
  }
  if (profile?.attributes && typeof profile.attributes === "object") {
    base.attributes = {
      ...(typeof base.attributes === "object" && base.attributes
        ? (base.attributes as object)
        : {}),
      ...(profile.attributes as object),
    };
  }

  const hasOfferings =
    ownerServices.length > 0 ||
    ownerKeywords.length > 0 ||
    menuItems.length > 0;
  const hasCopy =
    Boolean(profile?.tagline?.trim()) ||
    Boolean(profile?.description?.trim());
  const hasContact =
    Boolean(profile?.phone?.trim()) || Boolean(profile?.website?.trim());
  base.ownerProfileComplete = hasOfferings && (hasCopy || hasContact);

  return base;
}

function hoursToDescriptions(raw: Json): string[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const hours = raw as HoursOverride;
  const labels: Record<string, string> = {
    monday: "Monday",
    tuesday: "Tuesday",
    wednesday: "Wednesday",
    thursday: "Thursday",
    friday: "Friday",
    saturday: "Saturday",
    sunday: "Sunday",
  };
  const out: string[] = [];
  for (const [day, label] of Object.entries(labels)) {
    const row = hours[day as keyof HoursOverride];
    if (!row) continue;
    if (row.closed) out.push(`${label}: Closed`);
    else if (row.open && row.close)
      out.push(`${label}: ${row.open}–${row.close}`);
  }
  return out;
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (s): s is string => typeof s === "string" && s.trim().length > 0,
  );
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const v = raw.trim();
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}
