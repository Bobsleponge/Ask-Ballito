import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { refreshBusinessSearchEmbedding } from "@/lib/business-portal/refresh-business-embedding";
import { BusinessSpecialRepository } from "@/services/business-portal/business-special.repository";
import { businessMediaService } from "@/services/business-portal/business-media.service";
import type { SpecialRecurrence } from "@/lib/business-portal/special-live";
import type {
  BusinessSpecialKind,
  BusinessSpecialRow,
  BusinessSpecialScheduleType,
  BusinessSpecialStatus,
  Json,
} from "@/types/database";

export type SpecialWriteInput = {
  businessId: string;
  title: string;
  description?: string | null;
  status: BusinessSpecialStatus;
  kind: BusinessSpecialKind;
  discountLabel?: string | null;
  terms?: string | null;
  ctaUrl?: string | null;
  scheduleType: BusinessSpecialScheduleType;
  startsAt?: string | null;
  endsAt?: string | null;
  validFrom?: string | null;
  validUntil?: string | null;
  recurrence?: SpecialRecurrence | null;
  imagePath?: string | null;
  clearImage?: boolean;
};

export class BusinessSpecialService {
  async listForBusiness(businessId: string): Promise<BusinessSpecialRow[]> {
    const admin = createAdminClient();
    return new BusinessSpecialRepository(admin).listByBusiness(businessId);
  }

  async listActiveForBusinesses(
    businessIds: string[],
  ): Promise<BusinessSpecialRow[]> {
    const admin = createAdminClient();
    return new BusinessSpecialRepository(admin).listActiveByBusinessIds(
      businessIds,
    );
  }

  async get(specialId: string): Promise<BusinessSpecialRow | null> {
    const admin = createAdminClient();
    return new BusinessSpecialRepository(admin).findById(specialId);
  }

  async create(
    userId: string,
    input: SpecialWriteInput,
  ): Promise<BusinessSpecialRow> {
    const admin = createAdminClient();
    const row = await new BusinessSpecialRepository(admin).insert({
      business_id: input.businessId,
      title: input.title.trim(),
      description: emptyToNull(input.description),
      status: input.status,
      kind: input.kind,
      discount_label: emptyToNull(input.discountLabel),
      terms: emptyToNull(input.terms),
      cta_url: normalizeUrl(input.ctaUrl),
      schedule_type: input.scheduleType,
      starts_at:
        input.scheduleType === "one_time" ? emptyToNull(input.startsAt) : null,
      ends_at:
        input.scheduleType === "one_time" ? emptyToNull(input.endsAt) : null,
      valid_from:
        input.scheduleType === "recurring"
          ? emptyToNull(input.validFrom)
          : null,
      valid_until:
        input.scheduleType === "recurring"
          ? emptyToNull(input.validUntil)
          : null,
      recurrence:
        input.scheduleType === "recurring"
          ? ((input.recurrence ?? null) as Json | null)
          : null,
      image_path: input.imagePath ?? null,
      created_by: userId,
    });
    await refreshBusinessSearchEmbedding(input.businessId);
    return row;
  }

  async update(
    specialId: string,
    input: SpecialWriteInput,
  ): Promise<BusinessSpecialRow> {
    const admin = createAdminClient();
    const repo = new BusinessSpecialRepository(admin);
    const existing = await repo.findById(specialId);
    if (!existing || existing.business_id !== input.businessId) {
      throw new Error("Special not found");
    }

    let imagePath = existing.image_path;
    if (input.clearImage) {
      await businessMediaService.remove(existing.image_path);
      imagePath = null;
    } else if (input.imagePath !== undefined && input.imagePath !== null) {
      if (existing.image_path && existing.image_path !== input.imagePath) {
        await businessMediaService.remove(existing.image_path);
      }
      imagePath = input.imagePath;
    }

    const row = await repo.update(specialId, {
      title: input.title.trim(),
      description: emptyToNull(input.description),
      status: input.status,
      kind: input.kind,
      discount_label: emptyToNull(input.discountLabel),
      terms: emptyToNull(input.terms),
      cta_url: normalizeUrl(input.ctaUrl),
      schedule_type: input.scheduleType,
      starts_at:
        input.scheduleType === "one_time" ? emptyToNull(input.startsAt) : null,
      ends_at:
        input.scheduleType === "one_time" ? emptyToNull(input.endsAt) : null,
      valid_from:
        input.scheduleType === "recurring"
          ? emptyToNull(input.validFrom)
          : null,
      valid_until:
        input.scheduleType === "recurring"
          ? emptyToNull(input.validUntil)
          : null,
      recurrence:
        input.scheduleType === "recurring"
          ? ((input.recurrence ?? null) as Json | null)
          : null,
      image_path: imagePath,
    });
    await refreshBusinessSearchEmbedding(input.businessId);
    return row;
  }

  async archive(
    specialId: string,
    businessId: string,
  ): Promise<BusinessSpecialRow> {
    const admin = createAdminClient();
    const repo = new BusinessSpecialRepository(admin);
    const existing = await repo.findById(specialId);
    if (!existing || existing.business_id !== businessId) {
      throw new Error("Special not found");
    }
    const row = await repo.update(specialId, { status: "archived" });
    await refreshBusinessSearchEmbedding(businessId);
    return row;
  }

  async delete(specialId: string, businessId: string): Promise<void> {
    const admin = createAdminClient();
    const repo = new BusinessSpecialRepository(admin);
    const existing = await repo.findById(specialId);
    if (!existing || existing.business_id !== businessId) {
      throw new Error("Special not found");
    }
    if (existing.status === "active") {
      throw new Error("Archive an active special before deleting it");
    }
    await businessMediaService.remove(existing.image_path);
    await repo.delete(specialId);
    await refreshBusinessSearchEmbedding(businessId);
  }

  async duplicate(
    specialId: string,
    businessId: string,
    userId: string,
  ): Promise<BusinessSpecialRow> {
    const admin = createAdminClient();
    const repo = new BusinessSpecialRepository(admin);
    const existing = await repo.findById(specialId);
    if (!existing || existing.business_id !== businessId) {
      throw new Error("Special not found");
    }
    return repo.insert({
      business_id: businessId,
      title: `${existing.title} (copy)`,
      description: existing.description,
      status: "draft",
      kind: existing.kind,
      discount_label: existing.discount_label,
      terms: existing.terms,
      cta_url: existing.cta_url,
      schedule_type: existing.schedule_type,
      starts_at: existing.starts_at,
      ends_at: existing.ends_at,
      valid_from: existing.valid_from,
      valid_until: existing.valid_until,
      recurrence: existing.recurrence,
      image_path: null,
      created_by: userId,
    });
  }
}

function emptyToNull(value?: string | null): string | null {
  if (!value || !value.trim()) return null;
  return value.trim();
}

function normalizeUrl(value?: string | null): string | null {
  const t = emptyToNull(value);
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

export const businessSpecialService = new BusinessSpecialService();
