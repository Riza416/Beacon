import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { FieldDefinition, RequiredLevel } from "@/lib/types";

type DB = SupabaseClient<Database>;

// A workstream's request template lives in workstream_field_config: which
// fields it collects, at what required level (overriding the field's catalog
// default), and in what order. This module is the ONE place that resolves a
// template, so the request form and submit-time validation always agree.

/**
 * The ordered, active fields a given workstream collects, each carrying the
 * workstream's required-level override. Returns [] when productId is null —
 * a request with no workstream shows only the built-in fields.
 */
export async function resolveFieldsForProduct(
  db: DB,
  productId: string | null
): Promise<FieldDefinition[]> {
  if (!productId) return [];
  const { data, error } = await db
    .from("workstream_field_config")
    .select("required_level, field:request_field_definitions!inner(*)")
    .eq("product_id", productId)
    .eq("field.is_active", true)
    .order("display_order", { ascending: true })
    .returns<{ required_level: string; field: FieldDefinition }[]>();
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    ...r.field,
    // The workstream's level wins over the field's catalog default.
    required_level: r.required_level as RequiredLevel,
  }));
}

export interface TemplateRow {
  field: FieldDefinition;
  required_level: RequiredLevel;
  display_order: number;
  /** True when this field belongs only to this workstream (a custom field). */
  isCustom: boolean;
}

/**
 * A workstream's full template for the editor: every configured field (active
 * or not) with its level, order, and whether it's a workstream-custom field.
 */
export async function getWorkstreamTemplate(
  db: DB,
  productId: string
): Promise<TemplateRow[]> {
  const { data, error } = await db
    .from("workstream_field_config")
    .select("required_level, display_order, field:request_field_definitions!inner(*)")
    .eq("product_id", productId)
    .order("display_order", { ascending: true })
    .returns<
      { required_level: string; display_order: number; field: FieldDefinition }[]
    >();
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    field: r.field,
    required_level: r.required_level as RequiredLevel,
    display_order: r.display_order,
    isCustom: r.field.product_id === productId,
  }));
}

/**
 * The shared catalog fields (admin-managed, product_id is null) that are active
 * and NOT yet in this workstream's template — the "add from catalog" options.
 */
export async function getAddableCatalogFields(
  db: DB,
  productId: string
): Promise<FieldDefinition[]> {
  const [{ data: catalog, error: catErr }, { data: inUse, error: useErr }] =
    await Promise.all([
      db
        .from("request_field_definitions")
        .select("*")
        .is("product_id", null)
        .eq("is_active", true)
        .order("display_order", { ascending: true })
        .returns<FieldDefinition[]>(),
      db
        .from("workstream_field_config")
        .select("field_definition_id")
        .eq("product_id", productId)
        .returns<{ field_definition_id: string }[]>(),
    ]);
  if (catErr) throw new Error(catErr.message);
  if (useErr) throw new Error(useErr.message);
  const used = new Set((inUse ?? []).map((r) => r.field_definition_id));
  return (catalog ?? []).filter((f) => !used.has(f.id));
}

/** Next display_order slot (max + 1) for appending a field to a template. */
export async function nextTemplateOrder(
  db: DB,
  productId: string
): Promise<number> {
  const { data, error } = await db
    .from("workstream_field_config")
    .select("display_order")
    .eq("product_id", productId)
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle<{ display_order: number }>();
  if (error) throw new Error(error.message);
  return (data?.display_order ?? -1) + 1;
}
