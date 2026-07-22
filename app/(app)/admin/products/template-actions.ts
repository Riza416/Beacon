"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { authedAction, canEditProducts } from "@/lib/actions/utils";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAddableCatalogFields, nextTemplateOrder } from "@/lib/workstream-template";
import type { Database } from "@/lib/database.types";
import type { FieldType, Profile, RequiredLevel } from "@/lib/types";

type DB = SupabaseClient<Database>;

const VALID_FIELD_TYPES: FieldType[] = [
  "short_text",
  "long_text",
  "url",
  "file",
  "image",
  "select",
  "multi_select",
  "checkbox",
  "repo",
];
const TYPES_WITH_OPTIONS: FieldType[] = ["select", "multi_select"];
const VALID_REQUIRED_LEVELS: RequiredLevel[] = ["hard", "soft", "optional"];

/**
 * Authorize a template mutation for a workstream. Mirrors the "edit" branch of
 * authorizeProductWrite: global admins pass; otherwise the caller must have the
 * edit-products capability AND their team must own the workstream. Returns a
 * service-role client — the check above is the security boundary.
 */
async function authorizeTemplate(
  productId: string
): Promise<{ profile: Profile; admin: DB }> {
  if (!productId) throw new Error("Workstream id required");
  const { profile } = await authedAction();
  if (profile.role === "admin") {
    return { profile, admin: createAdminClient() };
  }
  if (!canEditProducts(profile) || !profile.team_id) {
    throw new Error("You aren't allowed to edit this workstream's template.");
  }
  const admin = createAdminClient();
  const { data } = await admin
    .from("product_owners")
    .select("team_id")
    .eq("product_id", productId)
    .eq("team_id", profile.team_id)
    .maybeSingle();
  if (!data) throw new Error("Your team doesn't own this workstream.");
  return { profile, admin };
}

function revalidateTemplate(productId: string) {
  revalidatePath(`/admin/products/${productId}/template`);
  revalidatePath(`/team/products/${productId}/template`);
  revalidatePath("/");
}

function parseFieldTypes(formData: FormData): FieldType[] {
  const raw = formData.getAll("field_types").map((v) => String(v));
  const seen = new Set<string>();
  const types: FieldType[] = [];
  for (const r of raw) {
    if (seen.has(r)) continue;
    seen.add(r);
    if (!VALID_FIELD_TYPES.includes(r as FieldType)) {
      throw new Error(`Invalid field type: ${r}`);
    }
    types.push(r as FieldType);
  }
  return types;
}

function parseOptions(raw: string): string[] | null {
  const lines = raw
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return lines.length ? lines : null;
}

function parseLevel(raw: string): RequiredLevel {
  const level = (raw || "optional") as RequiredLevel;
  if (!VALID_REQUIRED_LEVELS.includes(level))
    throw new Error("Invalid required level");
  return level;
}

/**
 * Toggle a built-in request field (Deadline / Dependent teams) on or off for a
 * workstream. Title / Summary / Workstream are always shown and not toggleable.
 */
export async function setBuiltinFieldEnabled(
  productId: string,
  field: "deadline" | "dependent_teams",
  enabled: boolean
): Promise<void> {
  const { admin } = await authorizeTemplate(productId);
  const update =
    field === "deadline"
      ? { show_deadline: enabled }
      : { show_dependent_teams: enabled };
  const { error } = await admin
    .from("products")
    .update(update)
    .eq("id", productId);
  if (error) throw new Error(error.message);
  revalidateTemplate(productId);
}

/** Add an existing shared-catalog field to a workstream's template. */
export async function addCatalogFieldToTemplate(
  productId: string,
  fieldId: string
): Promise<void> {
  const { admin } = await authorizeTemplate(productId);

  // The field must be a shared catalog field (product_id null) and available.
  const addable = await getAddableCatalogFields(admin, productId);
  const field = addable.find((f) => f.id === fieldId);
  if (!field) {
    throw new Error("That field isn't available to add to this workstream.");
  }

  const order = await nextTemplateOrder(admin, productId);
  const { error } = await admin.from("workstream_field_config").insert({
    product_id: productId,
    field_definition_id: fieldId,
    required_level: field.required_level,
    display_order: order,
  });
  if (error) throw new Error(error.message);
  revalidateTemplate(productId);
}

/** Create a workstream-custom field and add it to the workstream's template. */
export async function createCustomField(
  productId: string,
  formData: FormData
): Promise<void> {
  const { admin } = await authorizeTemplate(productId);

  const label = String(formData.get("label") ?? "").trim();
  const field_types = parseFieldTypes(formData);
  const required_level = parseLevel(String(formData.get("required_level") ?? ""));
  const help_text = String(formData.get("help_text") ?? "").trim() || null;
  const optionsRaw = String(formData.get("options") ?? "");

  if (!label) throw new Error("Label required");
  if (field_types.length === 0) throw new Error("Pick at least one field type");
  const optionsNeeded = field_types.some((t) => TYPES_WITH_OPTIONS.includes(t));
  const options = optionsNeeded ? parseOptions(optionsRaw) : null;

  // The definition is owned by this workstream (product_id set) — it never
  // shows in the shared catalog or another workstream's picker.
  const { data: def, error: defErr } = await admin
    .from("request_field_definitions")
    .insert({
      label,
      field_type: field_types[0],
      field_types,
      required_level,
      help_text,
      options,
      display_order: 0,
      is_active: true,
      product_id: productId,
    })
    .select("id")
    .single();
  if (defErr) throw new Error(defErr.message);

  const order = await nextTemplateOrder(admin, productId);
  const { error: cfgErr } = await admin.from("workstream_field_config").insert({
    product_id: productId,
    field_definition_id: def.id,
    required_level,
    display_order: order,
  });
  if (cfgErr) throw new Error(cfgErr.message);
  revalidateTemplate(productId);
}

/**
 * Set (or clear) the owner-configured repo URL for a "repo" field within a
 * workstream. Authors then see this repo on the request form with links to
 * request access and branch off. Empty string clears it.
 */
export async function setRepoUrl(
  productId: string,
  fieldId: string,
  url: string
): Promise<void> {
  const { admin } = await authorizeTemplate(productId);
  const trimmed = url.trim();
  if (trimmed.length > 0) {
    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      throw new Error("Enter a valid URL, e.g. https://github.com/org/repo");
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Repo link must be an http(s) URL");
    }
  }
  const { error } = await admin
    .from("workstream_field_config")
    .update({ repo_url: trimmed.length > 0 ? trimmed : null })
    .eq("product_id", productId)
    .eq("field_definition_id", fieldId);
  if (error) throw new Error(error.message);
  revalidateTemplate(productId);
}

/** Change a field's required level within a workstream's template. */
export async function setTemplateFieldLevel(
  productId: string,
  fieldId: string,
  level: RequiredLevel
): Promise<void> {
  const { admin } = await authorizeTemplate(productId);
  const required_level = parseLevel(level);
  const { error } = await admin
    .from("workstream_field_config")
    .update({ required_level })
    .eq("product_id", productId)
    .eq("field_definition_id", fieldId);
  if (error) throw new Error(error.message);
  revalidateTemplate(productId);
}

/** Move a field up or down within a workstream's template. */
export async function moveTemplateField(
  productId: string,
  fieldId: string,
  direction: "up" | "down"
): Promise<void> {
  const { admin } = await authorizeTemplate(productId);
  if (direction !== "up" && direction !== "down")
    throw new Error("Invalid direction");

  const { data: rows, error } = await admin
    .from("workstream_field_config")
    .select("field_definition_id, display_order")
    .eq("product_id", productId)
    .order("display_order", { ascending: true })
    .returns<{ field_definition_id: string; display_order: number }[]>();
  if (error) throw new Error(error.message);
  const list = rows ?? [];
  const idx = list.findIndex((r) => r.field_definition_id === fieldId);
  if (idx < 0) return;
  const swapWith = direction === "up" ? idx - 1 : idx + 1;
  if (swapWith < 0 || swapWith >= list.length) return; // at an edge

  const a = list[idx];
  const b = list[swapWith];
  // display_order has no unique constraint, so a direct swap is safe.
  const { error: e1 } = await admin
    .from("workstream_field_config")
    .update({ display_order: b.display_order })
    .eq("product_id", productId)
    .eq("field_definition_id", a.field_definition_id);
  if (e1) throw new Error(e1.message);
  const { error: e2 } = await admin
    .from("workstream_field_config")
    .update({ display_order: a.display_order })
    .eq("product_id", productId)
    .eq("field_definition_id", b.field_definition_id);
  if (e2) throw new Error(e2.message);
  revalidateTemplate(productId);
}

/**
 * Remove a field from a workstream's template. For a workstream-custom field we
 * also retire the underlying definition: hard-delete when nothing references it,
 * otherwise deactivate it (its FK to request_field_values is ON DELETE RESTRICT,
 * so historical values keep the definition alive but out of every template).
 */
export async function removeTemplateField(
  productId: string,
  fieldId: string
): Promise<void> {
  const { admin } = await authorizeTemplate(productId);

  const { data: def } = await admin
    .from("request_field_definitions")
    .select("id, product_id")
    .eq("id", fieldId)
    .maybeSingle<{ id: string; product_id: string | null }>();

  const { error } = await admin
    .from("workstream_field_config")
    .delete()
    .eq("product_id", productId)
    .eq("field_definition_id", fieldId);
  if (error) throw new Error(error.message);

  // Only clean up definitions this workstream owns (custom fields).
  if (def && def.product_id === productId) {
    const { count } = await admin
      .from("request_field_values")
      .select("id", { count: "exact", head: true })
      .eq("field_definition_id", fieldId);
    if ((count ?? 0) === 0) {
      await admin.from("request_field_definitions").delete().eq("id", fieldId);
    } else {
      await admin
        .from("request_field_definitions")
        .update({ is_active: false })
        .eq("id", fieldId);
    }
  }
  revalidateTemplate(productId);
}
