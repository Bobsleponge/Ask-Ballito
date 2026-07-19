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
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
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
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          city_slug?: string | null;
          title?: string | null;
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
          latency_ms?: number | null;
          status: string;
          error?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ai_logs"]["Insert"]>;
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
