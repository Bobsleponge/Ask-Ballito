import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { chunkIds } from "@/lib/supabase/chunk-ids";
import type {
  BusinessMenuItemInsert,
  BusinessMenuItemRow,
  Database,
} from "@/types/database";

type Client = SupabaseClient<Database>;

export class BusinessMenuItemRepository {
  constructor(private readonly client: Client) {}

  async listByBusiness(businessId: string): Promise<BusinessMenuItemRow[]> {
    const { data, error } = await this.client
      .from("business_menu_items")
      .select("*")
      .eq("business_id", businessId)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (error) throw new Error(`Failed to list menu items: ${error.message}`);
    return data ?? [];
  }

  async listByBusinessIds(
    businessIds: string[],
  ): Promise<BusinessMenuItemRow[]> {
    if (businessIds.length === 0) return [];
    const unique = [...new Set(businessIds)];
    const rows: BusinessMenuItemRow[] = [];
    for (const batch of chunkIds(unique)) {
      const { data, error } = await this.client
        .from("business_menu_items")
        .select("*")
        .in("business_id", batch)
        .order("sort_order", { ascending: true });
      if (error) throw new Error(`Failed to list menu items: ${error.message}`);
      if (data?.length) rows.push(...data);
    }
    return rows;
  }

  async findById(id: string): Promise<BusinessMenuItemRow | null> {
    const { data, error } = await this.client
      .from("business_menu_items")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`Failed to load menu item: ${error.message}`);
    return data;
  }

  async insert(row: BusinessMenuItemInsert): Promise<BusinessMenuItemRow> {
    const { data, error } = await this.client
      .from("business_menu_items")
      .insert(row)
      .select("*")
      .single();
    if (error) throw new Error(`Failed to create menu item: ${error.message}`);
    return data;
  }

  async insertMany(
    rows: BusinessMenuItemInsert[],
  ): Promise<BusinessMenuItemRow[]> {
    if (rows.length === 0) return [];
    const { data, error } = await this.client
      .from("business_menu_items")
      .insert(rows)
      .select("*");
    if (error) throw new Error(`Failed to create menu items: ${error.message}`);
    return data ?? [];
  }

  async update(
    id: string,
    patch: Partial<BusinessMenuItemInsert>,
  ): Promise<BusinessMenuItemRow> {
    const { data, error } = await this.client
      .from("business_menu_items")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(`Failed to update menu item: ${error.message}`);
    return data;
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.client
      .from("business_menu_items")
      .delete()
      .eq("id", id);
    if (error) throw new Error(`Failed to delete menu item: ${error.message}`);
  }

  async maxSortOrder(businessId: string): Promise<number> {
    const { data, error } = await this.client
      .from("business_menu_items")
      .select("sort_order")
      .eq("business_id", businessId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`Failed to read sort order: ${error.message}`);
    return data?.sort_order ?? -1;
  }
}
