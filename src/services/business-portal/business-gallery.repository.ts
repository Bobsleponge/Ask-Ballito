import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { chunkIds } from "@/lib/supabase/chunk-ids";
import type {
  BusinessGalleryInsert,
  BusinessGalleryRow,
  Database,
} from "@/types/database";

type Client = SupabaseClient<Database>;

export class BusinessGalleryRepository {
  constructor(private readonly client: Client) {}

  async listByBusiness(businessId: string): Promise<BusinessGalleryRow[]> {
    const { data, error } = await this.client
      .from("business_gallery")
      .select("*")
      .eq("business_id", businessId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw new Error(`Failed to list gallery: ${error.message}`);
    return data ?? [];
  }

  async listByBusinessIds(
    businessIds: string[],
  ): Promise<BusinessGalleryRow[]> {
    if (businessIds.length === 0) return [];
    const unique = [...new Set(businessIds)];
    const rows: BusinessGalleryRow[] = [];
    for (const batch of chunkIds(unique)) {
      const { data, error } = await this.client
        .from("business_gallery")
        .select("*")
        .in("business_id", batch)
        .order("sort_order", { ascending: true });
      if (error) throw new Error(`Failed to list gallery: ${error.message}`);
      if (data?.length) rows.push(...data);
    }
    return rows;
  }

  async findById(id: string): Promise<BusinessGalleryRow | null> {
    const { data, error } = await this.client
      .from("business_gallery")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`Failed to load gallery item: ${error.message}`);
    return data;
  }

  async insert(row: BusinessGalleryInsert): Promise<BusinessGalleryRow> {
    const { data, error } = await this.client
      .from("business_gallery")
      .insert(row)
      .select("*")
      .single();
    if (error) throw new Error(`Failed to add gallery image: ${error.message}`);
    return data;
  }

  async update(
    id: string,
    patch: Partial<BusinessGalleryInsert>,
  ): Promise<BusinessGalleryRow> {
    const { data, error } = await this.client
      .from("business_gallery")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(`Failed to update gallery: ${error.message}`);
    return data;
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.client
      .from("business_gallery")
      .delete()
      .eq("id", id);
    if (error) throw new Error(`Failed to delete gallery image: ${error.message}`);
  }

  async count(businessId: string): Promise<number> {
    const { count, error } = await this.client
      .from("business_gallery")
      .select("*", { count: "exact", head: true })
      .eq("business_id", businessId);
    if (error) throw new Error(`Failed to count gallery: ${error.message}`);
    return count ?? 0;
  }

  async maxSortOrder(businessId: string): Promise<number> {
    const { data, error } = await this.client
      .from("business_gallery")
      .select("sort_order")
      .eq("business_id", businessId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`Failed to read gallery sort: ${error.message}`);
    return data?.sort_order ?? -1;
  }
}
