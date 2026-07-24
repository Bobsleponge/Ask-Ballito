import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BusinessClaimInsert,
  BusinessClaimRow,
  BusinessClaimStatus,
  Database,
} from "@/types/database";

type Client = SupabaseClient<Database>;

export class BusinessClaimRepository {
  constructor(private readonly client: Client) {}

  async insert(row: BusinessClaimInsert): Promise<BusinessClaimRow> {
    const { data, error } = await this.client
      .from("business_claims")
      .insert(row)
      .select("*")
      .single();

    if (error) throw new Error(`Failed to insert claim: ${error.message}`);
    return data;
  }

  async findById(id: string): Promise<BusinessClaimRow | null> {
    const { data, error } = await this.client
      .from("business_claims")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw new Error(`Failed to load claim: ${error.message}`);
    return data;
  }

  async findPendingByBusiness(
    businessId: string,
  ): Promise<BusinessClaimRow | null> {
    const { data, error } = await this.client
      .from("business_claims")
      .select("*")
      .eq("business_id", businessId)
      .eq("status", "pending")
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to load pending claim: ${error.message}`);
    }
    return data;
  }

  async listByStatus(status: BusinessClaimStatus): Promise<BusinessClaimRow[]> {
    const { data, error } = await this.client
      .from("business_claims")
      .select("*")
      .eq("status", status)
      .order("submitted_at", { ascending: true });

    if (error) throw new Error(`Failed to list claims: ${error.message}`);
    return data ?? [];
  }

  async update(
    id: string,
    patch: Partial<BusinessClaimInsert>,
  ): Promise<BusinessClaimRow> {
    const { data, error } = await this.client
      .from("business_claims")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw new Error(`Failed to update claim: ${error.message}`);
    return data;
  }
}
