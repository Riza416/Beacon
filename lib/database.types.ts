// AUTO-GENERATED from the live schema by scripts/gen-types.mjs.
// Do not edit by hand — re-run the generator after a migration.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      comment_mentions: {
        Row: {
          comment_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          comment_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          comment_id?: string;
          user_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "comment_mentions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comment_mentions_comment_id_fkey";
            columns: ["comment_id"];
            isOneToOne: false;
            referencedRelation: "comments";
            referencedColumns: ["id"];
          },
        ];
      };
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
      companies: {
        Row: {
          id: string;
          name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
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
          show_deadline: boolean;
          show_dependent_teams: boolean;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
          show_deadline?: boolean;
          show_dependent_teams?: boolean;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
          show_deadline?: boolean;
          show_dependent_teams?: boolean;
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
          can_create_products: boolean;
          can_edit_products: boolean;
          can_delete_products: boolean;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          email?: string | null;
          role?: string;
          team_id?: string | null;
          created_at?: string;
          updated_at?: string;
          can_create_products?: boolean;
          can_edit_products?: boolean;
          can_delete_products?: boolean;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          email?: string | null;
          role?: string;
          team_id?: string | null;
          created_at?: string;
          updated_at?: string;
          can_create_products?: boolean;
          can_edit_products?: boolean;
          can_delete_products?: boolean;
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
      projects: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          owner_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          owner_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          owner_id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "projects_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
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
            foreignKeyName: "request_collaborators_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "requests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "request_collaborators_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
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
          product_id: string | null;
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
          product_id?: string | null;
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
          product_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "request_field_definitions_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
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
            foreignKeyName: "request_field_values_field_definition_id_fkey";
            columns: ["field_definition_id"];
            isOneToOne: false;
            referencedRelation: "request_field_definitions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "request_field_values_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "requests";
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
            foreignKeyName: "request_team_tags_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "requests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "request_team_tags_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      request_visibility_grants: {
        Row: {
          request_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          request_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          request_id?: string;
          user_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "request_visibility_grants_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "requests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "request_visibility_grants_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
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
          workstream_priority: number;
          project_id: string | null;
          is_private: boolean;
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
          workstream_priority?: number;
          project_id?: string | null;
          is_private?: boolean;
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
          workstream_priority?: number;
          project_id?: string | null;
          is_private?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "requests_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "requests_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
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
          {
            foreignKeyName: "requests_status_id_fkey";
            columns: ["status_id"];
            isOneToOne: false;
            referencedRelation: "statuses";
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
      team_slack_webhooks: {
        Row: {
          team_id: string;
          webhook_url: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          team_id: string;
          webhook_url: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          team_id?: string;
          webhook_url?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "team_slack_webhooks_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      teams: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          created_at: string;
          updated_at: string;
          company_id: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
          company_id?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
          company_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "teams_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      workstream_field_config: {
        Row: {
          product_id: string;
          field_definition_id: string;
          required_level: string;
          display_order: number;
          created_at: string;
          repo_url: string | null;
        };
        Insert: {
          product_id: string;
          field_definition_id: string;
          required_level?: string;
          display_order?: number;
          created_at?: string;
          repo_url?: string | null;
        };
        Update: {
          product_id?: string;
          field_definition_id?: string;
          required_level?: string;
          display_order?: number;
          created_at?: string;
          repo_url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "workstream_field_config_field_definition_id_fkey";
            columns: ["field_definition_id"];
            isOneToOne: false;
            referencedRelation: "request_field_definitions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workstream_field_config_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
