// Domain types. Table shapes are derived from the generated `Database` type
// (single source of truth — re-run scripts/gen-types.mjs after a migration),
// then narrowed where the DB uses a plain `text`/`text[]` column but the app
// enforces a fixed set of values via CHECK constraints.
import type { Database } from "@/lib/database.types";

export type Role = "admin" | "team_admin" | "user";
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

type Row<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type Team = Row<"teams">;
export type Product = Row<"products">;

export type Profile = Omit<Row<"profiles">, "role"> & { role: Role };

export type Status = Row<"statuses">;

export type FieldDefinition = Omit<
  Row<"request_field_definitions">,
  "field_type" | "field_types" | "required_level" | "options"
> & {
  /** Legacy single-type column, kept for back-compat. Equals `field_types[0]`. */
  field_type: FieldType;
  /** Allowed input types; the form renders one sub-input per entry. */
  field_types: FieldType[];
  required_level: RequiredLevel;
  options: string[] | null;
};

/** A row of a workstream's request template (which field, at what level/order). */
export type WorkstreamFieldConfig = Omit<
  Row<"workstream_field_config">,
  "required_level"
> & {
  required_level: RequiredLevel;
};

export type RequestRow = Omit<Row<"requests">, "state"> & {
  state: RequestState;
};

export type FieldValue = Omit<Row<"request_field_values">, "field_type"> & {
  field_type: FieldType;
};

export type Comment = Row<"comments">;
