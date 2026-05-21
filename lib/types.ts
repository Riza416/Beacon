export type Role = "admin" | "user";
export type RequestState = "draft" | "submitted";
export type FieldType =
  | "short_text"
  | "long_text"
  | "url"
  | "file"
  | "image"
  | "select"
  | "multi_select"
  | "checkbox";
export type RequiredLevel = "hard" | "soft" | "optional";

export interface Team {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  role: Role;
  team_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Status {
  id: string;
  label: string;
  color: string;
  display_order: number;
  is_default: boolean;
  is_terminal: boolean;
  created_at: string;
  updated_at: string;
}

export interface FieldDefinition {
  id: string;
  label: string;
  field_type: FieldType;
  required_level: RequiredLevel;
  help_text: string | null;
  options: string[] | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RequestRow {
  id: string;
  title: string;
  summary: string | null;
  author_id: string;
  team_id: string | null;
  status_id: string | null;
  priority: number;
  state: RequestState;
  submitted_at: string | null;
  notion_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface FieldValue {
  id: string;
  request_id: string;
  field_definition_id: string;
  value_text: string | null;
  file_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface Comment {
  id: string;
  request_id: string;
  author_id: string;
  body: string;
  created_at: string;
}
