import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { refreshBusinessSearchEmbedding } from "@/lib/business-portal/refresh-business-embedding";
import { scheduleSearchRestudy } from "@/lib/business-portal/schedule-search-restudy";
import { BusinessProfileRepository } from "@/services/business-portal/business-profile.repository";
import { businessMediaService } from "@/services/business-portal/business-media.service";
import type { HoursOverride } from "@/lib/schemas/business-profile";
import type { BusinessAttributes } from "@/lib/schemas/business-attributes";
import type { BusinessProfileRow, Json } from "@/types/database";

export class BusinessProfileService {
  async get(businessId: string): Promise<BusinessProfileRow | null> {
    const admin = createAdminClient();
    return new BusinessProfileRepository(admin).findByBusinessId(businessId);
  }

  async getMany(businessIds: string[]): Promise<BusinessProfileRow[]> {
    const admin = createAdminClient();
    return new BusinessProfileRepository(admin).findByBusinessIds(businessIds);
  }

  async updateListing(
    businessId: string,
    userId: string,
    input: {
      tagline?: string | null;
      description?: string | null;
      phone?: string | null;
      website?: string | null;
      hoursOverride?: HoursOverride | null;
      attributes?: BusinessAttributes;
      listingVertical?: string | null;
    },
  ): Promise<BusinessProfileRow> {
    const admin = createAdminClient();
    const repo = new BusinessProfileRepository(admin);
    const existing = await repo.findByBusinessId(businessId);

    const row = await repo.upsert({
      ...baseFromExisting(existing, businessId),
      tagline:
        input.tagline === undefined
          ? existing?.tagline ?? null
          : input.tagline?.trim() || null,
      description:
        input.description === undefined
          ? existing?.description ?? null
          : input.description?.trim() || null,
      phone:
        input.phone === undefined
          ? existing?.phone ?? null
          : input.phone?.trim() || null,
      website:
        input.website === undefined
          ? existing?.website ?? null
          : normalizeWebsite(input.website),
      hours_override:
        input.hoursOverride === undefined
          ? existing?.hours_override ?? null
          : (input.hoursOverride as Json | null),
      attributes:
        input.attributes === undefined
          ? existing?.attributes ?? {}
          : (input.attributes as Json),
      listing_vertical:
        input.listingVertical === undefined
          ? existing?.listing_vertical ?? null
          : input.listingVertical?.trim() || null,
      updated_by: userId,
    });

    await refreshBusinessSearchEmbedding(businessId);
    await scheduleSearchRestudy(businessId).catch((err) => {
      console.warn(
        "[profile] scheduleRestudy failed:",
        err instanceof Error ? err.message : err,
      );
    });
    return row;
  }

  async updateServicesKeywords(
    businessId: string,
    userId: string,
    input: { services: string[]; keywords: string[] },
  ): Promise<BusinessProfileRow> {
    const admin = createAdminClient();
    const repo = new BusinessProfileRepository(admin);
    const existing = await repo.findByBusinessId(businessId);

    const row = await repo.upsert({
      ...baseFromExisting(existing, businessId),
      services: normalizeStringList(input.services),
      keywords: normalizeStringList(input.keywords),
      updated_by: userId,
    });

    await refreshBusinessSearchEmbedding(businessId);
    return row;
  }

  async updateNotifications(
    businessId: string,
    userId: string,
    input: {
      notifySpecialReminders?: boolean;
      notifyTeamUpdates?: boolean;
    },
  ): Promise<BusinessProfileRow> {
    const admin = createAdminClient();
    const repo = new BusinessProfileRepository(admin);
    const existing = await repo.findByBusinessId(businessId);

    return repo.upsert({
      ...baseFromExisting(existing, businessId),
      notify_special_reminders:
        input.notifySpecialReminders ??
        existing?.notify_special_reminders ??
        true,
      notify_team_updates:
        input.notifyTeamUpdates ?? existing?.notify_team_updates ?? true,
      updated_by: userId,
    });
  }

  async setMediaPath(
    businessId: string,
    userId: string,
    kind: "logo" | "hero",
    path: string,
  ): Promise<BusinessProfileRow> {
    const admin = createAdminClient();
    const repo = new BusinessProfileRepository(admin);
    const existing = await repo.findByBusinessId(businessId);

    return repo.upsert({
      ...baseFromExisting(existing, businessId),
      logo_path: kind === "logo" ? path : existing?.logo_path ?? null,
      hero_path: kind === "hero" ? path : existing?.hero_path ?? null,
      updated_by: userId,
    });
  }

  async clearMediaPath(
    businessId: string,
    userId: string,
    kind: "logo" | "hero",
  ): Promise<BusinessProfileRow> {
    const admin = createAdminClient();
    const repo = new BusinessProfileRepository(admin);
    const existing = await repo.findByBusinessId(businessId);
    const path =
      kind === "logo" ? existing?.logo_path : existing?.hero_path;
    await businessMediaService.remove(path);

    return repo.upsert({
      ...baseFromExisting(existing, businessId),
      logo_path: kind === "logo" ? null : existing?.logo_path ?? null,
      hero_path: kind === "hero" ? null : existing?.hero_path ?? null,
      updated_by: userId,
    });
  }
}

function baseFromExisting(
  existing: BusinessProfileRow | null,
  businessId: string,
): {
  business_id: string;
  description: string | null;
  phone: string | null;
  website: string | null;
  logo_path: string | null;
  hero_path: string | null;
  services: string[];
  keywords: string[];
  tagline: string | null;
  hours_override: Json | null;
  attributes: Json;
  listing_vertical: string | null;
  notify_special_reminders: boolean;
  notify_team_updates: boolean;
} {
  return {
    business_id: businessId,
    description: existing?.description ?? null,
    phone: existing?.phone ?? null,
    website: existing?.website ?? null,
    logo_path: existing?.logo_path ?? null,
    hero_path: existing?.hero_path ?? null,
    services: existing?.services ?? [],
    keywords: existing?.keywords ?? [],
    tagline: existing?.tagline ?? null,
    hours_override: existing?.hours_override ?? null,
    attributes: existing?.attributes ?? {},
    listing_vertical: existing?.listing_vertical ?? null,
    notify_special_reminders: existing?.notify_special_reminders ?? true,
    notify_team_updates: existing?.notify_team_updates ?? true,
  };
}

function normalizeStringList(values: string[]): string[] {
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

function normalizeWebsite(value: string | null | undefined): string | null {
  const trimmed = value?.trim() || "";
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export const businessProfileService = new BusinessProfileService();
