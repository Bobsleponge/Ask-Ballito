import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BusinessInviteInsert,
  BusinessInviteRow,
  Database,
} from "@/types/database";

type Client = SupabaseClient<Database>;

export class BusinessInviteRepository {
  constructor(private readonly client: Client) {}

  async listByBusiness(businessId: string): Promise<BusinessInviteRow[]> {
    const { data, error } = await this.client
      .from("business_invites")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(`Failed to list invites: ${error.message}`);
    return data ?? [];
  }

  async findByToken(token: string): Promise<BusinessInviteRow | null> {
    const { data, error } = await this.client
      .from("business_invites")
      .select("*")
      .eq("token", token)
      .maybeSingle();
    if (error) throw new Error(`Failed to load invite: ${error.message}`);
    return data;
  }

  async insert(row: BusinessInviteInsert): Promise<BusinessInviteRow> {
    const { data, error } = await this.client
      .from("business_invites")
      .insert(row)
      .select("*")
      .single();
    if (error) throw new Error(`Failed to create invite: ${error.message}`);
    return data;
  }

  async update(
    id: string,
    patch: Partial<BusinessInviteInsert>,
  ): Promise<BusinessInviteRow> {
    const { data, error } = await this.client
      .from("business_invites")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(`Failed to update invite: ${error.message}`);
    return data;
  }
}
