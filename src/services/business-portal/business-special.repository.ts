import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { chunkIds } from "@/lib/supabase/chunk-ids";
import type {
  BusinessSpecialInsert,
  BusinessSpecialRow,
  Database,
} from "@/types/database";
import { isSpecialLive } from "@/lib/business-portal/special-live";

type Client = SupabaseClient<Database>;

export class BusinessSpecialRepository {
  constructor(private readonly client: Client) {}

  async listByBusiness(businessId: string): Promise<BusinessSpecialRow[]> {
    const { data, error } = await this.client
      .from("business_specials")
      .select("*")
      .eq("business_id", businessId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(`Failed to list specials: ${error.message}`);
    return data ?? [];
  }

  async listActiveByBusinessIds(
    businessIds: string[],
  ): Promise<BusinessSpecialRow[]> {
    if (businessIds.length === 0) return [];
    const unique = [...new Set(businessIds)];
    const rows: BusinessSpecialRow[] = [];
    for (const batch of chunkIds(unique)) {
      const { data, error } = await this.client
        .from("business_specials")
        .select("*")
        .in("business_id", batch)
        .eq("status", "active");
      if (error) {
        throw new Error(`Failed to list active specials: ${error.message}`);
      }
      if (data?.length) rows.push(...data);
    }
    const now = new Date();
    return rows.filter((row) => isSpecialLive(row, now));
  }

  async findById(id: string): Promise<BusinessSpecialRow | null> {
    const { data, error } = await this.client
      .from("business_specials")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`Failed to load special: ${error.message}`);
    return data;
  }

  async insert(row: BusinessSpecialInsert): Promise<BusinessSpecialRow> {
    const { data, error } = await this.client
      .from("business_specials")
      .insert(row)
      .select("*")
      .single();
    if (error) throw new Error(`Failed to create special: ${error.message}`);
    return data;
  }

  async update(
    id: string,
    patch: Partial<BusinessSpecialInsert>,
  ): Promise<BusinessSpecialRow> {
    const { data, error } = await this.client
      .from("business_specials")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(`Failed to update special: ${error.message}`);
    return data;
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.client
      .from("business_specials")
      .delete()
      .eq("id", id);
    if (error) throw new Error(`Failed to delete special: ${error.message}`);
  }
}
