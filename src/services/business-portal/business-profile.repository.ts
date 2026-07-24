import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { chunkIds } from "@/lib/supabase/chunk-ids";
import type {
  BusinessProfileInsert,
  BusinessProfileRow,
  Database,
} from "@/types/database";

type Client = SupabaseClient<Database>;

export class BusinessProfileRepository {
  constructor(private readonly client: Client) {}

  async findByBusinessId(
    businessId: string,
  ): Promise<BusinessProfileRow | null> {
    const { data, error } = await this.client
      .from("business_profiles")
      .select("*")
      .eq("business_id", businessId)
      .maybeSingle();
    if (error) throw new Error(`Failed to load profile: ${error.message}`);
    return data;
  }

  async findByBusinessIds(
    businessIds: string[],
  ): Promise<BusinessProfileRow[]> {
    if (businessIds.length === 0) return [];
    const unique = [...new Set(businessIds)];
    const rows: BusinessProfileRow[] = [];
    for (const batch of chunkIds(unique)) {
      const { data, error } = await this.client
        .from("business_profiles")
        .select("*")
        .in("business_id", batch);
      if (error) throw new Error(`Failed to load profiles: ${error.message}`);
      if (data?.length) rows.push(...data);
    }
    return rows;
  }

  async upsert(row: BusinessProfileInsert): Promise<BusinessProfileRow> {
    const { data, error } = await this.client
      .from("business_profiles")
      .upsert(row, { onConflict: "business_id" })
      .select("*")
      .single();
    if (error) throw new Error(`Failed to save profile: ${error.message}`);
    return data;
  }
}
