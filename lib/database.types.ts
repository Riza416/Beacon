// AUTO-GENERATED from the live schema by scripts/gen-types.mjs.
// Do not edit by hand — re-run the generator after a migration.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      comments: {
        Row: {
          id: string;
          request_id: string;
          author_id: string;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          request_id: string;
          author_id: string;
          body: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          request_id?: string;
          author_id?: string;
          body?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "comments_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "requests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comments_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      product_owners: {
        Row: {
          product_id: string;
          team_id: string;
          created_at: string;
        };
        Insert: {
          product_id: string;
          team_id: string;
          created_at?: string;
        };
        Update: {
          product_id?: string;
          team_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_owners_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_owners_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          email: string | null;
          role: string;
          team_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          email?: string | null;
          role?: string;
          team_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          email?: string | null;
          role?: string;
          team_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      request_collaborators: {
        Row: {
          request_id: string;
          user_id: string;
          created_at: string;
          viewed_at: string | null;
        };
        Insert: {
          request_id: string;
          user_id: string;
          created_at?: string;
          viewed_at?: string | null;
        };
        Update: {
          request_id?: string;
          user_id?: string;
          created_at?: string;
          viewed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "request_collaborators_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "request_collaborators_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "requests";
            referencedColumns: ["id"];
          },
        ];
      };
      request_field_definitions: {
        Row: {
          id: string;
          label: string;
          field_type: string;
          required_level: string;
          help_text: string | null;
          options: Json | null;
          display_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
          field_types: string[];
        };
        Insert: {
          id?: string;
          label: string;
          field_type: string;
          required_level?: string;
          help_text?: string | null;
          options?: Json | null;
          display_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          field_types?: string[];
        };
        Update: {
          id?: string;
          label?: string;
          field_type?: string;
          required_level?: string;
          help_text?: string | null;
          options?: Json | null;
          display_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          field_types?: string[];
        };
        Relationships: [];
      };
      request_field_values: {
        Row: {
          id: string;
          request_id: string;
          field_definition_id: string;
          value_text: string | null;
          file_path: string | null;
          created_at: string;
          updated_at: string;
          field_type: string;
        };
        Insert: {
          id?: string;
          request_id: string;
          field_definition_id: string;
          value_text?: string | null;
          file_path?: string | null;
          created_at?: string;
          updated_at?: string;
          field_type: string;
        };
        Update: {
          id?: string;
          request_id?: string;
          field_definition_id?: string;
          value_text?: string | null;
          file_path?: string | null;
          created_at?: string;
          updated_at?: string;
          field_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "request_field_values_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "requests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "request_field_values_field_definition_id_fkey";
            columns: ["field_definition_id"];
            isOneToOne: false;
            referencedRelation: "request_field_definitions";
            referencedColumns: ["id"];
          },
        ];
      };
      request_team_tag_views: {
        Row: {
          request_id: string;
          team_id: string;
          user_id: string;
          viewed_at: string;
        };
        Insert: {
          request_id: string;
          team_id: string;
          user_id: string;
          viewed_at?: string;
        };
        Update: {
          request_id?: string;
          team_id?: string;
          user_id?: string;
          viewed_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "request_team_tag_views_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "request_team_tag_views_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "requests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "request_team_tag_views_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      request_team_tags: {
        Row: {
          request_id: string;
          team_id: string;
          created_at: string;
        };
        Insert: {
          request_id: string;
          team_id: string;
          created_at?: string;
        };
        Update: {
          request_id?: string;
          team_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "request_team_tags_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "request_team_tags_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "requests";
            referencedColumns: ["id"];
          },
        ];
      };
      requests: {
        Row: {
          id: string;
          title: string;
          summary: string | null;
          author_id: string;
          team_id: string | null;
          status_id: string | null;
          priority: number;
          state: string;
          submitted_at: string | null;
          notion_url: string | null;
          created_at: string;
          updated_at: string;
          team_priority: number;
          product_id: string | null;
          deadline: string | null;
        };
        Insert: {
          id?: string;
          title: string;
          summary?: string | null;
          author_id: string;
          team_id?: string | null;
          status_id?: string | null;
          priority?: number;
          state?: string;
          submitted_at?: string | null;
          notion_url?: string | null;
          created_at?: string;
          updated_at?: string;
          team_priority?: number;
          product_id?: string | null;
          deadline?: string | null;
        };
        Update: {
          id?: string;
          title?: string;
          summary?: string | null;
          author_id?: string;
          team_id?: string | null;
          status_id?: string | null;
          priority?: number;
          state?: string;
          submitted_at?: string | null;
          notion_url?: string | null;
          created_at?: string;
          updated_at?: string;
          team_priority?: number;
          product_id?: string | null;
          deadline?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "requests_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "requests_status_id_fkey";
            columns: ["status_id"];
            isOneToOne: false;
            referencedRelation: "statuses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "requests_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "requests_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      statuses: {
        Row: {
          id: string;
          label: string;
          color: string;
          display_order: number;
          is_default: boolean;
          is_terminal: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          label: string;
          color?: string;
          display_order?: number;
          is_default?: boolean;
          is_terminal?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          label?: string;
          color?: string;
          display_order?: number;
          is_default?: boolean;
          is_terminal?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      teams: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          created_at: string;
          updated_at: string;
          can_manage_products: boolean;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
          can_manage_products?: boolean;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
          can_manage_products?: boolean;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
