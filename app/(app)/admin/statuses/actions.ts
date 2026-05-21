"use server";

import { revalidatePath } from "next/cache";
import { adminAction } from "@/lib/actions/utils";

function parseStatusForm(formData: FormData) {
  const label = String(formData.get("label") ?? "").trim();
  const color = String(formData.get("color") ?? "#64748b").trim() || "#64748b";
  const is_default = String(formData.get("is_default") ?? "false") === "true";
  const is_terminal = String(formData.get("is_terminal") ?? "false") === "true";
  if (!label) throw new Error("Label required");
  return { label, color, is_default, is_terminal };
}

export async function createStatus(formData: FormData) {
  const { supabase } = await adminAction();
  const { label, color, is_default, is_terminal } = parseStatusForm(formData);

  if (is_default) {
    const { error: clearError } = await supabase
      .from("statuses")
      .update({ is_default: false })
      .eq("is_default", true);
    if (clearError) throw new Error(clearError.message);
  }

  const { data: maxRow } = await supabase
    .from("statuses")
    .select("display_order")
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle<{ display_order: number }>();

  const nextOrder = (maxRow?.display_order ?? -1) + 1;

  const { error } = await supabase.from("statuses").insert({
    label,
    color,
    is_default,
    is_terminal,
    display_order: nextOrder,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/statuses");
}

export async function updateStatus(formData: FormData) {
  const { supabase } = await adminAction();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Status id required");
  const { label, color, is_default, is_terminal } = parseStatusForm(formData);

  if (is_default) {
    const { error: clearError } = await supabase
      .from("statuses")
      .update({ is_default: false })
      .neq("id", id)
      .eq("is_default", true);
    if (clearError) throw new Error(clearError.message);
  }

  const { error } = await supabase
    .from("statuses")
    .update({ label, color, is_default, is_terminal })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/statuses");
}

export async function deleteStatus(formData: FormData) {
  const { supabase } = await adminAction();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Status id required");
  const { error } = await supabase.from("statuses").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/statuses");
}

export async function mergeAndDeleteStatus(formData: FormData) {
  const { supabase } = await adminAction();
  const fromId = String(formData.get("from_id") ?? "");
  const intoIdRaw = String(formData.get("into_id") ?? "").trim();
  const intoId = intoIdRaw === "" ? null : intoIdRaw;

  if (!fromId) throw new Error("Status to delete required");
  if (intoId === fromId) throw new Error("Cannot merge a status into itself");

  // Reassign every request currently on `from` to `into` (or null).
  const { error: reErr } = await supabase
    .from("requests")
    .update({ status_id: intoId })
    .eq("status_id", fromId);
  if (reErr) throw new Error(reErr.message);

  const { error: delErr } = await supabase
    .from("statuses")
    .delete()
    .eq("id", fromId);
  if (delErr) throw new Error(delErr.message);

  revalidatePath("/admin/statuses");
  revalidatePath("/");
}

export async function moveStatus(formData: FormData) {
  const { supabase } = await adminAction();
  const id = String(formData.get("id") ?? "");
  const direction = String(formData.get("direction") ?? "");
  if (!id) throw new Error("Status id required");
  if (direction !== "up" && direction !== "down")
    throw new Error("Invalid direction");

  const { data: current } = await supabase
    .from("statuses")
    .select("id, display_order")
    .eq("id", id)
    .maybeSingle<{ id: string; display_order: number }>();
  if (!current) throw new Error("Status not found");

  const baseQuery = supabase.from("statuses").select("id, display_order");
  const { data: neighbor } =
    direction === "up"
      ? await baseQuery
          .lt("display_order", current.display_order)
          .order("display_order", { ascending: false })
          .limit(1)
          .maybeSingle<{ id: string; display_order: number }>()
      : await baseQuery
          .gt("display_order", current.display_order)
          .order("display_order", { ascending: true })
          .limit(1)
          .maybeSingle<{ id: string; display_order: number }>();

  if (!neighbor) return;

  const tempOrder = -1 - Math.abs(current.display_order) - Math.abs(neighbor.display_order);

  const { error: e1 } = await supabase
    .from("statuses")
    .update({ display_order: tempOrder })
    .eq("id", current.id);
  if (e1) throw new Error(e1.message);

  const { error: e2 } = await supabase
    .from("statuses")
    .update({ display_order: current.display_order })
    .eq("id", neighbor.id);
  if (e2) throw new Error(e2.message);

  const { error: e3 } = await supabase
    .from("statuses")
    .update({ display_order: neighbor.display_order })
    .eq("id", current.id);
  if (e3) throw new Error(e3.message);

  revalidatePath("/admin/statuses");
}
