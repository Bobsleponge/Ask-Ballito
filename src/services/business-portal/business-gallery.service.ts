import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { BusinessGalleryRepository } from "@/services/business-portal/business-gallery.repository";
import { businessMediaService } from "@/services/business-portal/business-media.service";
import type { BusinessGalleryRow } from "@/types/database";

const MAX_GALLERY = 12;

export class BusinessGalleryService {
  async list(businessId: string): Promise<BusinessGalleryRow[]> {
    const admin = createAdminClient();
    return new BusinessGalleryRepository(admin).listByBusiness(businessId);
  }

  async listForBusinesses(
    businessIds: string[],
  ): Promise<BusinessGalleryRow[]> {
    const admin = createAdminClient();
    return new BusinessGalleryRepository(admin).listByBusinessIds(businessIds);
  }

  async add(
    businessId: string,
    path: string,
    caption?: string | null,
  ): Promise<BusinessGalleryRow> {
    const admin = createAdminClient();
    const repo = new BusinessGalleryRepository(admin);
    const count = await repo.count(businessId);
    if (count >= MAX_GALLERY) {
      throw new Error(`At most ${MAX_GALLERY} gallery images`);
    }
    const max = await repo.maxSortOrder(businessId);
    return repo.insert({
      business_id: businessId,
      path,
      caption: caption?.trim() || null,
      sort_order: max + 1,
    });
  }

  async updateCaption(
    businessId: string,
    imageId: string,
    caption: string | null,
  ): Promise<BusinessGalleryRow> {
    const admin = createAdminClient();
    const repo = new BusinessGalleryRepository(admin);
    const existing = await repo.findById(imageId);
    if (!existing || existing.business_id !== businessId) {
      throw new Error("Gallery image not found");
    }
    return repo.update(imageId, { caption: caption?.trim() || null });
  }

  async delete(businessId: string, imageId: string): Promise<void> {
    const admin = createAdminClient();
    const repo = new BusinessGalleryRepository(admin);
    const existing = await repo.findById(imageId);
    if (!existing || existing.business_id !== businessId) {
      throw new Error("Gallery image not found");
    }
    await businessMediaService.remove(existing.path);
    await repo.delete(imageId);
  }

  async reorder(businessId: string, orderedIds: string[]): Promise<void> {
    const admin = createAdminClient();
    const repo = new BusinessGalleryRepository(admin);
    const existing = await repo.listByBusiness(businessId);
    const byId = new Map(existing.map((r) => [r.id, r]));
    for (let i = 0; i < orderedIds.length; i++) {
      const id = orderedIds[i];
      const row = byId.get(id);
      if (!row || row.sort_order === i) continue;
      await repo.update(id, { sort_order: i });
    }
  }
}

export const businessGalleryService = new BusinessGalleryService();
