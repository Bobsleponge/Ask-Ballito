import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { refreshBusinessSearchEmbedding } from "@/lib/business-portal/refresh-business-embedding";
import { enrichBusinessService } from "@/services/enrichment/enrich-business.service";
import { offeringsStudyService } from "@/services/business-portal/offerings-study.service";
import { businessProfileService } from "@/services/business-portal/business-profile.service";
import { businessMenuItemService } from "@/services/business-portal/business-menu-item.service";
import { BusinessProfileRepository } from "@/services/business-portal/business-profile.repository";
import type { BusinessProfileRow, Json } from "@/types/database";
import { scheduleSearchRestudy } from "@/lib/business-portal/schedule-search-restudy";

export { SEARCH_RESTUDY_DELAY_MS } from "@/lib/business-portal/search-ingest-constants";

export type SearchIngestResult = {
  businessId: string;
  placesEnriched: boolean;
  placesSkippedReason?: string;
  studied: boolean;
  servicesAdded: number;
  keywordsAdded: number;
  alreadyIngested: boolean;
};

export type SearchRestudyBatchResult = {
  scanned: number;
  studied: number;
  failed: number;
  errors: Array<{ businessId: string; message: string }>;
};

function mergeUnique(existing: string[], incoming: string[], max = 40): string[] {
  const out = [...existing];
  const seen = new Set(existing.map((s) => s.toLowerCase()));
  for (const raw of incoming) {
    const v = raw.trim();
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
    if (out.length >= max) break;
  }
  return out;
}

function verticalsFrom(metadata: unknown): string[] {
  if (!metadata || typeof metadata !== "object") return [];
  const verticals = (metadata as { verticals?: unknown }).verticals;
  if (!Array.isArray(verticals)) return [];
  return verticals.filter((v): v is string => typeof v === "string");
}

function stringListFromMeta(metadata: unknown, key: "services" | "keywords"): string[] {
  if (!metadata || typeof metadata !== "object") return [];
  const raw = (metadata as Record<string, unknown>)[key];
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
}

/**
 * One-time claim ingest + deferred 48h offerings restudy.
 * Immediate portal embeds stay cheap; expensive LLM study is batched.
 */
export class BusinessSearchIngestService {
  /**
   * Admin one-time ingest: Places enrich (if needed) → study offerings →
   * seed/merge profile chips → embed → stamp search_ingested_at.
   */
  async ingestBusiness(
    businessId: string,
    opts: { force?: boolean; actorUserId?: string | null } = {},
  ): Promise<SearchIngestResult> {
    const admin = createAdminClient();
    const { data: row, error } = await admin
      .from("businesses")
      .select(
        "id, name, category, city_slug, metadata, search_ingested_at",
      )
      .eq("id", businessId)
      .maybeSingle();

    if (error) throw new Error(`Failed to load business: ${error.message}`);
    if (!row) throw new Error("Business not found");

    const alreadyIngested =
      typeof row.search_ingested_at === "string" && !opts.force;
    if (alreadyIngested) {
      return {
        businessId,
        placesEnriched: false,
        studied: false,
        servicesAdded: 0,
        keywordsAdded: 0,
        alreadyIngested: true,
      };
    }

    const places = await enrichBusinessService.enrichBusinessById(businessId, {
      force: Boolean(opts.force),
    });

    // Reload metadata after possible Places enrich.
    const { data: fresh } = await admin
      .from("businesses")
      .select("id, name, category, metadata")
      .eq("id", businessId)
      .maybeSingle();

    const metadata = fresh?.metadata ?? row.metadata;
    const businessName = fresh?.name ?? row.name;
    const category = fresh?.category ?? row.category;

    const profile = await businessProfileService.get(businessId);
    const menuRows = await businessMenuItemService.list(businessId);
    const menuItems = menuRows.map((m) => ({
      name: m.name,
      description: m.description ?? "",
      price: m.price ?? "",
      category: m.category ?? "",
    }));

    let studied = false;
    let studyServices: string[] = [];
    let studyKeywords: string[] = [];

    if (menuItems.length > 0) {
      try {
        const suggestion = await offeringsStudyService.study({
          businessName,
          category,
          verticals: verticalsFrom(metadata),
          items: menuItems,
          existingServices: profile?.services ?? [],
          existingKeywords: profile?.keywords ?? [],
        });
        studyServices = suggestion.services;
        studyKeywords = suggestion.keywords;
        studied = true;
      } catch (err) {
        console.warn(
          "[search-ingest] offerings study failed:",
          err instanceof Error ? err.message : err,
        );
      }
    }

    const metaServices = stringListFromMeta(metadata, "services");
    const metaKeywords = stringListFromMeta(metadata, "keywords");

    const beforeServices = profile?.services ?? [];
    const beforeKeywords = profile?.keywords ?? [];

    const nextServices = mergeUnique(
      beforeServices,
      [...metaServices, ...studyServices],
    );
    const nextKeywords = mergeUnique(
      beforeKeywords,
      [...metaKeywords, ...studyKeywords],
    );

    await this.upsertProfileServicesKeywords({
      businessId,
      existing: profile,
      services: nextServices,
      keywords: nextKeywords,
      actorUserId: opts.actorUserId ?? null,
    });

    await refreshBusinessSearchEmbedding(businessId);

    const now = new Date().toISOString();
    const { error: stampError } = await admin
      .from("businesses")
      .update({
        search_ingested_at: now,
        search_last_studied_at: now,
        search_restudy_due_at: null,
        updated_at: now,
      })
      .eq("id", businessId);

    if (stampError) {
      throw new Error(`Failed to stamp ingest: ${stampError.message}`);
    }

    return {
      businessId,
      placesEnriched: places.enriched,
      placesSkippedReason: places.skippedReason,
      studied,
      servicesAdded: nextServices.length - beforeServices.length,
      keywordsAdded: nextKeywords.length - beforeKeywords.length,
      alreadyIngested: false,
    };
  }

  /**
   * Mark a claimed/ingested business for deferred LLM restudy.
   * First dirty event starts a 48h clock; later edits do not push it out.
   */
  async scheduleRestudy(businessId: string): Promise<void> {
    await scheduleSearchRestudy(businessId);
  }

  /**
   * Process businesses whose restudy is due. Safe for cron (paced, capped).
   */
  async processDueRestudies(limit = 25): Promise<SearchRestudyBatchResult> {
    const admin = createAdminClient();
    const now = new Date().toISOString();

    const { data, error } = await admin
      .from("businesses")
      .select("id, name, category, metadata")
      .not("search_ingested_at", "is", null)
      .not("search_restudy_due_at", "is", null)
      .lte("search_restudy_due_at", now)
      .order("search_restudy_due_at", { ascending: true })
      .limit(limit);

    if (error) throw new Error(`Failed to load due restudies: ${error.message}`);

    const rows = data ?? [];
    const result: SearchRestudyBatchResult = {
      scanned: rows.length,
      studied: 0,
      failed: 0,
      errors: [],
    };

    for (const row of rows) {
      try {
        await this.restudyOne(row.id);
        result.studied += 1;
      } catch (err) {
        result.failed += 1;
        result.errors.push({
          businessId: row.id,
          message: err instanceof Error ? err.message : "restudy failed",
        });
      }
      await sleep(150);
    }

    return result;
  }

  private async restudyOne(businessId: string): Promise<void> {
    const admin = createAdminClient();
    const { data: row, error } = await admin
      .from("businesses")
      .select("id, name, category, metadata")
      .eq("id", businessId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!row) throw new Error("Business not found");

    const profile = await businessProfileService.get(businessId);
    const menuRows = await businessMenuItemService.list(businessId);
    const menuItems = menuRows.map((m) => ({
      name: m.name,
      description: m.description ?? "",
      price: m.price ?? "",
      category: m.category ?? "",
    }));

    if (menuItems.length === 0) {
      await refreshBusinessSearchEmbedding(businessId);
      await this.clearRestudyDue(businessId, false);
      return;
    }

    const suggestion = await offeringsStudyService.study({
      businessName: row.name,
      category: row.category,
      verticals: verticalsFrom(row.metadata),
      items: menuItems,
      existingServices: profile?.services ?? [],
      existingKeywords: profile?.keywords ?? [],
    });

    const nextServices = mergeUnique(
      profile?.services ?? [],
      suggestion.services,
    );
    const nextKeywords = mergeUnique(
      profile?.keywords ?? [],
      suggestion.keywords,
    );

    await this.upsertProfileServicesKeywords({
      businessId,
      existing: profile,
      services: nextServices,
      keywords: nextKeywords,
      actorUserId: null,
    });

    await refreshBusinessSearchEmbedding(businessId);
    await this.clearRestudyDue(businessId, true);
  }

  private async clearRestudyDue(
    businessId: string,
    studied: boolean,
  ): Promise<void> {
    const admin = createAdminClient();
    const now = new Date().toISOString();
    const patch: {
      search_restudy_due_at: null;
      updated_at: string;
      search_last_studied_at?: string;
    } = {
      search_restudy_due_at: null,
      updated_at: now,
    };
    if (studied) patch.search_last_studied_at = now;

    const { error } = await admin
      .from("businesses")
      .update(patch)
      .eq("id", businessId);
    if (error) throw new Error(error.message);
  }

  private async upsertProfileServicesKeywords(params: {
    businessId: string;
    existing: BusinessProfileRow | null;
    services: string[];
    keywords: string[];
    actorUserId: string | null;
  }): Promise<void> {
    const admin = createAdminClient();
    const repo = new BusinessProfileRepository(admin);
    const existing = params.existing;

    await repo.upsert({
      business_id: params.businessId,
      description: existing?.description ?? null,
      phone: existing?.phone ?? null,
      website: existing?.website ?? null,
      logo_path: existing?.logo_path ?? null,
      hero_path: existing?.hero_path ?? null,
      services: params.services,
      keywords: params.keywords,
      tagline: existing?.tagline ?? null,
      hours_override: (existing?.hours_override ?? null) as Json | null,
      attributes: (existing?.attributes ?? {}) as Json,
      listing_vertical: existing?.listing_vertical ?? null,
      notify_special_reminders: existing?.notify_special_reminders ?? true,
      notify_team_updates: existing?.notify_team_updates ?? true,
      updated_by: params.actorUserId,
    });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const businessSearchIngestService = new BusinessSearchIngestService();
