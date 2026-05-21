"use server";

import { revalidatePath } from "next/cache";
import { adminAction } from "@/lib/actions/utils";
import type { FieldType, RequiredLevel } from "@/lib/types";

const VALID_FIELD_TYPES: FieldType[] = [
  "short_text",
  "long_text",
  "url",
  "file",
  "image",
  "select",
  "checkbox",
];
const VALID_REQUIRED_LEVELS: RequiredLevel[] = ["hard", "soft", "optional"];

function parseOptions(raw: string): string[] | null {
  const lines = raw
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return lines.length ? lines : null;
}

export async function createField(formData: FormData) {
  const { supabase } = await adminAction();
  const label = String(formData.get("label") ?? "").trim();
  const field_type = String(formData.get("field_type") ?? "") as FieldType;
  const required_level = String(formData.get("required_level") ?? "optional") as RequiredLevel;
  const help_text = String(formData.get("help_text") ?? "").trim() || null;
  const optionsRaw = String(formData.get("options") ?? "");

  if (!label) throw new Error("Label required");
  if (!VALID_FIELD_TYPES.includes(field_type)) throw new Error("Invalid field type");
  if (!VALID_REQUIRED_LEVELS.includes(required_level))
    throw new Error("Invalid required level");

  const options = field_type === "select" ? parseOptions(optionsRaw) : null;

  const { data: maxRow } = await supabase
    .from("request_field_definitions")
    .select("display_order")
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle<{ display_order: number }>();

  const nextOrder = (maxRow?.display_order ?? -1) + 1;

  const { error } = await supabase.from("request_field_definitions").insert({
    label,
    field_type,
    required_level,
    help_text,
    options,
    display_order: nextOrder,
    is_active: true,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/requirements");
}

export async function updateField(formData: FormData) {
  const { supabase } = await adminAction();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Field id required");

  const label = String(formData.get("label") ?? "").trim();
  const required_level = String(formData.get("required_level") ?? "optional") as RequiredLevel;
  const help_text = String(formData.get("help_text") ?? "").trim() || null;
  const field_type = String(formData.get("field_type") ?? "") as FieldType;
  const optionsRaw = String(formData.get("options") ?? "");

  if (!label) throw new Error("Label required");
  if (!VALID_REQUIRED_LEVELS.includes(required_level))
    throw new Error("Invalid required level");

  const options = field_type === "select" ? parseOptions(optionsRaw) : null;

  const { error } = await supabase
    .from("request_field_definitions")
    .update({ label, required_level, help_text, options })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/requirements");
}

export async function toggleFieldActive(formData: FormData) {
  const { supabase } = await adminAction();
  const id = String(formData.get("id") ?? "");
  const nextActive = String(formData.get("is_active") ?? "false") === "true";
  if (!id) throw new Error("Field id required");
  const { error } = await supabase
    .from("request_field_definitions")
    .update({ is_active: nextActive })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/requirements");
}

export async function moveField(formData: FormData) {
  const { supabase } = await adminAction();
  const id = String(formData.get("id") ?? "");
  const direction = String(formData.get("direction") ?? "");
  if (!id) throw new Error("Field id required");
  if (direction !== "up" && direction !== "down")
    throw new Error("Invalid direction");

  const { data: current } = await supabase
    .from("request_field_definitions")
    .select("id, display_order")
    .eq("id", id)
    .maybeSingle<{ id: string; display_order: number }>();
  if (!current) throw new Error("Field not found");

  const neighborQuery = supabase
    .from("request_field_definitions")
    .select("id, display_order");

  const { data: neighbor } =
    direction === "up"
      ? await neighborQuery
          .lt("display_order", current.display_order)
          .order("display_order", { ascending: false })
          .limit(1)
          .maybeSingle<{ id: string; display_order: number }>()
      : await neighborQuery
          .gt("display_order", current.display_order)
          .order("display_order", { ascending: true })
          .limit(1)
          .maybeSingle<{ id: string; display_order: number }>();

  if (!neighbor) return; // already at edge

  // Swap display_order between current and neighbor.
  // Use a temp value to avoid (unlikely) unique constraint conflicts.
  const tempOrder = -1 - Math.abs(current.display_order) - Math.abs(neighbor.display_order);

  const { error: e1 } = await supabase
    .from("request_field_definitions")
    .update({ display_order: tempOrder })
    .eq("id", current.id);
  if (e1) throw new Error(e1.message);

  const { error: e2 } = await supabase
    .from("request_field_definitions")
    .update({ display_order: current.display_order })
    .eq("id", neighbor.id);
  if (e2) throw new Error(e2.message);

  const { error: e3 } = await supabase
    .from("request_field_definitions")
    .update({ display_order: neighbor.display_order })
    .eq("id", current.id);
  if (e3) throw new Error(e3.message);

  revalidatePath("/admin/requirements");
}
