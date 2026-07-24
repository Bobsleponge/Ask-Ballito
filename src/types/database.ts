/**
 * Hand-maintained database types mirroring supabase/migrations.
 * Regenerate with the Supabase CLI once a project is linked:
 *   supabase gen types typescript --linked > src/types/database.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface BusinessPhoto {
  url: string;
  attribution?: string;
  width?: number;
  height?: number;
}

export interface Database {
  public: {
    Tables: {
      cities: {
        Row: {
          slug: string;
          name: string;
          region: string | null;
          country: string | null;
          center_lat: number | null;
          center_lng: number | null;
          enabled: boolean;
          created_at: string;
        };
        Insert: {
          slug: string;
          name: string;
          region?: string | null;
          country?: string | null;
          center_lat?: number | null;
          center_lng?: number | null;
          enabled?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["cities"]["Insert"]>;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          email: string | null;
          full_name: string | null;
          avatar_url: string | null;
          phone: string | null;
          is_admin: boolean;
          abuse_suspended: boolean;
          notify_claim_updates: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          phone?: string | null;
          is_admin?: boolean;
          abuse_suspended?: boolean;
          notify_claim_updates?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      businesses: {
        Row: {
          id: string;
          provider: string;
          external_id: string | null;
          city_slug: string;
          name: string;
          category: string | null;
          categories: string[];
          description: string | null;
          address: string | null;
          phone: string | null;
          website: string | null;
          rating: number | null;
          rating_count: number | null;
          price_level: number | null;
          lat: number | null;
          lng: number | null;
          photos: Json;
          metadata: Json;
          embedding: string | null;
          embedding_text: string | null;
          search_ingested_at: string | null;
          search_restudy_due_at: string | null;
          search_last_studied_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          provider: string;
          external_id?: string | null;
          city_slug: string;
          name: string;
          category?: string | null;
          categories?: string[];
          description?: string | null;
          address?: string | null;
          phone?: string | null;
          website?: string | null;
          rating?: number | null;
          rating_count?: number | null;
          price_level?: number | null;
          lat?: number | null;
          lng?: number | null;
          photos?: Json;
          metadata?: Json;
          embedding?: string | null;
          embedding_text?: string | null;
          search_ingested_at?: string | null;
          search_restudy_due_at?: string | null;
          search_last_studied_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["businesses"]["Insert"]>;
        Relationships: [];
      };
      conversations: {
        Row: {
          id: string;
          user_id: string | null;
          city_slug: string | null;
          title: string | null;
          sticky_summary: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          city_slug?: string | null;
          title?: string | null;
          sticky_summary?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["conversations"]["Insert"]>;
        Relationships: [];
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          role: "user" | "assistant" | "system";
          content: string;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          role: "user" | "assistant" | "system";
          content: string;
          metadata?: Json;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["messages"]["Insert"]>;
        Relationships: [];
      };
      ai_logs: {
        Row: {
          id: string;
          user_id: string | null;
          conversation_id: string | null;
          service: string;
          prompt_version: string | null;
          model: string | null;
          input: Json;
          output: Json;
          input_tokens: number | null;
          output_tokens: number | null;
          estimated_cost_usd: number | null;
          latency_ms: number | null;
          status: string;
          error: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          conversation_id?: string | null;
          service: string;
          prompt_version?: string | null;
          model?: string | null;
          input?: Json;
          output?: Json;
          input_tokens?: number | null;
          output_tokens?: number | null;
          estimated_cost_usd?: number | null;
          latency_ms?: number | null;
          status: string;
          error?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ai_logs"]["Insert"]>;
        Relationships: [];
      };
      business_members: {
        Row: {
          id: string;
          business_id: string;
          user_id: string;
          role: string;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          user_id: string;
          role: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["business_members"]["Insert"]>;
        Relationships: [];
      };
      business_claims: {
        Row: {
          id: string;
          business_id: string;
          user_id: string;
          status: string;
          verification_method: string;
          claimant_name: string;
          claimant_email: string;
          claimant_phone: string;
          claimant_role: string;
          notes: string | null;
          submitted_at: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
          rejection_reason: string | null;
        };
        Insert: {
          id?: string;
          business_id: string;
          user_id: string;
          status?: string;
          verification_method?: string;
          claimant_name: string;
          claimant_email: string;
          claimant_phone: string;
          claimant_role: string;
          notes?: string | null;
          submitted_at?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          rejection_reason?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["business_claims"]["Insert"]>;
        Relationships: [];
      };
      business_profiles: {
        Row: {
          business_id: string;
          description: string | null;
          phone: string | null;
          website: string | null;
          logo_path: string | null;
          hero_path: string | null;
          services: string[];
          keywords: string[];
          tagline: string | null;
          hours_override: Json | null;
          attributes: Json;
          listing_vertical: string | null;
          notify_special_reminders: boolean;
          notify_team_updates: boolean;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          business_id: string;
          description?: string | null;
          phone?: string | null;
          website?: string | null;
          logo_path?: string | null;
          hero_path?: string | null;
          services?: string[];
          keywords?: string[];
          tagline?: string | null;
          hours_override?: Json | null;
          attributes?: Json;
          listing_vertical?: string | null;
          notify_special_reminders?: boolean;
          notify_team_updates?: boolean;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["business_profiles"]["Insert"]>;
        Relationships: [];
      };
      business_menu_items: {
        Row: {
          id: string;
          business_id: string;
          name: string;
          description: string | null;
          price: string | null;
          category: string | null;
          image_path: string | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          name: string;
          description?: string | null;
          price?: string | null;
          category?: string | null;
          image_path?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["business_menu_items"]["Insert"]>;
        Relationships: [];
      };
      business_gallery: {
        Row: {
          id: string;
          business_id: string;
          path: string;
          caption: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          path: string;
          caption?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["business_gallery"]["Insert"]>;
        Relationships: [];
      };
      business_specials: {
        Row: {
          id: string;
          business_id: string;
          title: string;
          description: string | null;
          image_path: string | null;
          starts_at: string | null;
          ends_at: string | null;
          status: string;
          kind: string;
          discount_label: string | null;
          terms: string | null;
          cta_url: string | null;
          schedule_type: string;
          recurrence: Json | null;
          valid_from: string | null;
          valid_until: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          business_id: string;
          title: string;
          description?: string | null;
          image_path?: string | null;
          starts_at?: string | null;
          ends_at?: string | null;
          status?: string;
          kind?: string;
          discount_label?: string | null;
          terms?: string | null;
          cta_url?: string | null;
          schedule_type?: string;
          recurrence?: Json | null;
          valid_from?: string | null;
          valid_until?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["business_specials"]["Insert"]>;
        Relationships: [];
      };
      business_invites: {
        Row: {
          id: string;
          business_id: string;
          email: string;
          role: string;
          token: string;
          status: string;
          invited_by: string | null;
          created_at: string;
          expires_at: string;
          accepted_at: string | null;
        };
        Insert: {
          id?: string;
          business_id: string;
          email: string;
          role?: string;
          token: string;
          status?: string;
          invited_by?: string | null;
          created_at?: string;
          expires_at: string;
          accepted_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["business_invites"]["Insert"]>;
        Relationships: [];
      };
      search_events: {
        Row: {
          id: string;
          city_slug: string;
          query_raw: string;
          query_norm: string;
          query_hash: string;
          user_id: string | null;
          session_id: string | null;
          source: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          city_slug: string;
          query_raw: string;
          query_norm: string;
          query_hash: string;
          user_id?: string | null;
          session_id?: string | null;
          source?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["search_events"]["Insert"]>;
        Relationships: [];
      };
      trending_queries: {
        Row: {
          city_slug: string;
          query_norm: string;
          display_text: string;
          hit_count: number;
          window_start: string;
          window_end: string;
        };
        Insert: {
          city_slug: string;
          query_norm: string;
          display_text: string;
          hit_count?: number;
          window_start: string;
          window_end: string;
        };
        Update: Partial<Database["public"]["Tables"]["trending_queries"]["Insert"]>;
        Relationships: [];
      };
      city_events: {
        Row: {
          id: string;
          city_slug: string;
          title: string;
          description: string | null;
          venue_name: string | null;
          address: string | null;
          lat: number | null;
          lng: number | null;
          starts_at: string;
          ends_at: string | null;
          url: string | null;
          source: string;
          external_id: string | null;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          city_slug: string;
          title: string;
          description?: string | null;
          venue_name?: string | null;
          address?: string | null;
          lat?: number | null;
          lng?: number | null;
          starts_at: string;
          ends_at?: string | null;
          url?: string | null;
          source?: string;
          external_id?: string | null;
          status?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["city_events"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      match_businesses: {
        Args: {
          p_city_slug: string;
          query_embedding: string;
          match_count?: number;
          similarity_threshold?: number;
          p_category?: string | null;
        };
        Returns: {
          id: string;
          name: string;
          category: string | null;
          description: string | null;
          address: string | null;
          website: string | null;
          phone: string | null;
          rating: number | null;
          rating_count: number | null;
          price_level: number | null;
          lat: number | null;
          lng: number | null;
          photos: Json;
          metadata: Json;
          similarity: number;
        }[];
      };
      purge_old_ai_logs: {
        Args: {
          retention_days?: number;
        };
        Returns: number;
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
}

export type BusinessRow = Database["public"]["Tables"]["businesses"]["Row"];
export type BusinessInsert = Database["public"]["Tables"]["businesses"]["Insert"];
export type MatchedBusiness =
  Database["public"]["Functions"]["match_businesses"]["Returns"][number];
export type ConversationRow = Database["public"]["Tables"]["conversations"]["Row"];
export type MessageRow = Database["public"]["Tables"]["messages"]["Row"];
export type AiLogInsert = Database["public"]["Tables"]["ai_logs"]["Insert"];
export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type BusinessMemberRow =
  Database["public"]["Tables"]["business_members"]["Row"];
export type BusinessMemberInsert =
  Database["public"]["Tables"]["business_members"]["Insert"];
export type BusinessClaimRow =
  Database["public"]["Tables"]["business_claims"]["Row"];
export type BusinessClaimInsert =
  Database["public"]["Tables"]["business_claims"]["Insert"];
export type BusinessMemberRole = "owner" | "manager";
export type BusinessMemberStatus = "active" | "inactive";
export type BusinessClaimStatus = "pending" | "approved" | "rejected";
export type BusinessClaimantRole =
  | "owner"
  | "manager"
  | "marketing"
  | "other";
export type BusinessProfileRow =
  Database["public"]["Tables"]["business_profiles"]["Row"];
export type BusinessProfileInsert =
  Database["public"]["Tables"]["business_profiles"]["Insert"];
export type BusinessSpecialRow =
  Database["public"]["Tables"]["business_specials"]["Row"];
export type BusinessSpecialInsert =
  Database["public"]["Tables"]["business_specials"]["Insert"];
export type BusinessSpecialStatus = "draft" | "active" | "archived";
export type BusinessSpecialKind = "deal" | "happy_hour" | "event" | "other";
export type BusinessSpecialScheduleType = "one_time" | "recurring";
export type BusinessMenuItemRow =
  Database["public"]["Tables"]["business_menu_items"]["Row"];
export type BusinessMenuItemInsert =
  Database["public"]["Tables"]["business_menu_items"]["Insert"];
export type BusinessGalleryRow =
  Database["public"]["Tables"]["business_gallery"]["Row"];
export type BusinessGalleryInsert =
  Database["public"]["Tables"]["business_gallery"]["Insert"];
export type BusinessInviteRow =
  Database["public"]["Tables"]["business_invites"]["Row"];
export type BusinessInviteInsert =
  Database["public"]["Tables"]["business_invites"]["Insert"];
export type BusinessInviteStatus =
  | "pending"
  | "accepted"
  | "revoked"
  | "expired";
