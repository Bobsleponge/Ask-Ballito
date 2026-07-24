import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { refreshBusinessSearchEmbedding } from "@/lib/business-portal/refresh-business-embedding";
import { scheduleSearchRestudy } from "@/lib/business-portal/schedule-search-restudy";
import { BusinessMenuItemRepository } from "@/services/business-portal/business-menu-item.repository";
import { businessMediaService } from "@/services/business-portal/business-media.service";
import type { BusinessMenuItemRow } from "@/types/database";

export type MenuItemInput = {
  name: string;
  description?: string | null;
  price?: string | null;
  category?: string | null;
};

async function afterOfferingsChange(businessId: string): Promise<void> {
  await refreshBusinessSearchEmbedding(businessId);
  await scheduleSearchRestudy(businessId).catch((err) => {
    console.warn(
      "[menu] scheduleRestudy failed:",
      err instanceof Error ? err.message : err,
    );
  });
}

export class BusinessMenuItemService {
  async list(businessId: string): Promise<BusinessMenuItemRow[]> {
    const admin = createAdminClient();
    return new BusinessMenuItemRepository(admin).listByBusiness(businessId);
  }

  async listForBusinesses(
    businessIds: string[],
  ): Promise<BusinessMenuItemRow[]> {
    const admin = createAdminClient();
    return new BusinessMenuItemRepository(admin).listByBusinessIds(businessIds);
  }

  async create(
    businessId: string,
    input: MenuItemInput,
  ): Promise<BusinessMenuItemRow> {
    const admin = createAdminClient();
    const repo = new BusinessMenuItemRepository(admin);
    const max = await repo.maxSortOrder(businessId);
    const row = await repo.insert({
      business_id: businessId,
      name: input.name.trim(),
      description: emptyToNull(input.description),
      price: emptyToNull(input.price),
      category: emptyToNull(input.category),
      sort_order: max + 1,
    });
    await afterOfferingsChange(businessId);
    return row;
  }

  async createMany(
    businessId: string,
    items: MenuItemInput[],
  ): Promise<BusinessMenuItemRow[]> {
    if (items.length === 0) return [];
    const admin = createAdminClient();
    const repo = new BusinessMenuItemRepository(admin);
    let sort = (await repo.maxSortOrder(businessId)) + 1;
    const rows = await repo.insertMany(
      items.map((item) => {
        const row = {
          business_id: businessId,
          name: item.name.trim(),
          description: emptyToNull(item.description),
          price: emptyToNull(item.price),
          category: emptyToNull(item.category),
          sort_order: sort,
        };
        sort += 1;
        return row;
      }),
    );
    await afterOfferingsChange(businessId);
    return rows;
  }

  async update(
    businessId: string,
    itemId: string,
    input: MenuItemInput & { sortOrder?: number },
  ): Promise<BusinessMenuItemRow> {
    const admin = createAdminClient();
    const repo = new BusinessMenuItemRepository(admin);
    const existing = await repo.findById(itemId);
    if (!existing || existing.business_id !== businessId) {
      throw new Error("Menu item not found");
    }
    const row = await repo.update(itemId, {
      name: input.name.trim(),
      description: emptyToNull(input.description),
      price: emptyToNull(input.price),
      category: emptyToNull(input.category),
      ...(input.sortOrder !== undefined ? { sort_order: input.sortOrder } : {}),
    });
    await afterOfferingsChange(businessId);
    return row;
  }

  async setImage(
    businessId: string,
    itemId: string,
    path: string,
  ): Promise<BusinessMenuItemRow> {
    const admin = createAdminClient();
    const repo = new BusinessMenuItemRepository(admin);
    const existing = await repo.findById(itemId);
    if (!existing || existing.business_id !== businessId) {
      throw new Error("Menu item not found");
    }
    if (existing.image_path && existing.image_path !== path) {
      await businessMediaService.remove(existing.image_path);
    }
    return repo.update(itemId, { image_path: path });
  }

  async clearImage(businessId: string, itemId: string): Promise<void> {
    const admin = createAdminClient();
    const repo = new BusinessMenuItemRepository(admin);
    const existing = await repo.findById(itemId);
    if (!existing || existing.business_id !== businessId) {
      throw new Error("Menu item not found");
    }
    await businessMediaService.remove(existing.image_path);
    await repo.update(itemId, { image_path: null });
  }

  async delete(businessId: string, itemId: string): Promise<void> {
    const admin = createAdminClient();
    const repo = new BusinessMenuItemRepository(admin);
    const existing = await repo.findById(itemId);
    if (!existing || existing.business_id !== businessId) {
      throw new Error("Menu item not found");
    }
    await businessMediaService.remove(existing.image_path);
    await repo.delete(itemId);
    await afterOfferingsChange(businessId);
  }

  async reorder(
    businessId: string,
    orderedIds: string[],
  ): Promise<void> {
    const admin = createAdminClient();
    const repo = new BusinessMenuItemRepository(admin);
    const existing = await repo.listByBusiness(businessId);
    const byId = new Map(existing.map((r) => [r.id, r]));
    for (let i = 0; i < orderedIds.length; i++) {
      const id = orderedIds[i];
      const row = byId.get(id);
      if (!row) continue;
      if (row.sort_order !== i) {
        await repo.update(id, { sort_order: i });
      }
    }
  }
}

function emptyToNull(value?: string | null): string | null {
  const t = value?.trim();
  return t ? t : null;
}

export const businessMenuItemService = new BusinessMenuItemService();
