import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BusinessMemberInsert,
  BusinessMemberRow,
  BusinessMemberRole,
  Database,
} from "@/types/database";

type Client = SupabaseClient<Database>;

export class BusinessMemberRepository {
  constructor(private readonly client: Client) {}

  async insert(row: BusinessMemberInsert): Promise<BusinessMemberRow> {
    const { data, error } = await this.client
      .from("business_members")
      .insert(row)
      .select("*")
      .single();

    if (error) throw new Error(`Failed to insert membership: ${error.message}`);
    return data;
  }

  async findActive(
    businessId: string,
    userId: string,
  ): Promise<BusinessMemberRow | null> {
    const { data, error } = await this.client
      .from("business_members")
      .select("*")
      .eq("business_id", businessId)
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to load membership: ${error.message}`);
    }
    return data;
  }

  async findActiveOwner(businessId: string): Promise<BusinessMemberRow | null> {
    const { data, error } = await this.client
      .from("business_members")
      .select("*")
      .eq("business_id", businessId)
      .eq("role", "owner")
      .eq("status", "active")
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to load active owner: ${error.message}`);
    }
    return data;
  }

  async listActiveByUser(userId: string): Promise<BusinessMemberRow[]> {
    const { data, error } = await this.client
      .from("business_members")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error(`Failed to list memberships: ${error.message}`);
    }
    return data ?? [];
  }

  async listByBusiness(businessId: string): Promise<BusinessMemberRow[]> {
    const { data, error } = await this.client
      .from("business_members")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error(`Failed to list business members: ${error.message}`);
    }
    return data ?? [];
  }

  async hasActiveRole(
    businessId: string,
    userId: string,
    role: BusinessMemberRole,
  ): Promise<boolean> {
    const membership = await this.findActive(businessId, userId);
    return membership?.role === role;
  }

  async update(
    id: string,
    patch: Partial<BusinessMemberInsert>,
  ): Promise<BusinessMemberRow> {
    const { data, error } = await this.client
      .from("business_members")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(`Failed to update membership: ${error.message}`);
    return data;
  }

  async findAny(
    businessId: string,
    userId: string,
  ): Promise<BusinessMemberRow | null> {
    const { data, error } = await this.client
      .from("business_members")
      .select("*")
      .eq("business_id", businessId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(`Failed to load membership: ${error.message}`);
    return data;
  }
}
