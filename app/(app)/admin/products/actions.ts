"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminAction } from "@/lib/actions/utils";
import type { Database } from "@/lib/database.types";

type DB = SupabaseClient<Database>;
const UNIQUE_VIOLATION = "23505";

function parseProduct(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  if (!name) throw new Error("Name required");
  return { name, description };
}

/** Owning-team ids submitted by the dialog as repeated `owner_team_ids` fields. */
function parseOwnerTeamIds(formData: FormData): string[] {
  const seen = new Set<string>();
  for (const v of formData.getAll("owner_team_ids")) {
    const id = String(v).trim();
    if (id) seen.add(id);
  }
  return [...seen];
}

function friendlyProductError(
  err: { code?: string; message: string },
  name: string
): Error {
  if (err.code === UNIQUE_VIOLATION) {
    return new Error(`A product called "${name}" already exists.`);
  }
  return new Error(err.message);
}

/**
 * Make product_owners for `productId` exactly equal `teamIds`: insert the
 * missing rows, delete the ones no longer selected.
 */
async function syncProductOwners(
  supabase: DB,
  productId: string,
  teamIds: string[]
): Promise<void> {
  const { data: existing, error: readErr } = await supabase
    .from("product_owners")
    .select("team_id")
    .eq("product_id", productId);
  if (readErr) throw new Error(readErr.message);

  const current = new Set((existing ?? []).map((r) => r.team_id));
  const next = new Set(teamIds);

  const toInsert = teamIds.filter((id) => !current.has(id));
  const toDelete = [...current].filter((id) => !next.has(id));

  if (toInsert.length > 0) {
    const { error } = await supabase
      .from("product_owners")
      .insert(toInsert.map((team_id) => ({ product_id: productId, team_id })));
    if (error) throw new Error(error.message);
  }
  if (toDelete.length > 0) {
    const { error } = await supabase
      .from("product_owners")
      .delete()
      .eq("product_id", productId)
      .in("team_id", toDelete);
    if (error) throw new Error(error.message);
  }
}

export async function createProduct(formData: FormData) {
  const { supabase } = await adminAction();
  const { name, description } = parseProduct(formData);
  const ownerTeamIds = parseOwnerTeamIds(formData);

  const { data, error } = await supabase
    .from("products")
    .insert({ name, description })
    .select("id")
    .single();
  if (error) throw friendlyProductError(error, name);

  await syncProductOwners(supabase, data.id, ownerTeamIds);

  revalidatePath("/admin/products");
  revalidatePath("/");
}

export async function updateProduct(formData: FormData) {
  const { supabase } = await adminAction();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Product id required");
  const { name, description } = parseProduct(formData);
  const ownerTeamIds = parseOwnerTeamIds(formData);

  const { error } = await supabase
    .from("products")
    .update({ name, description })
    .eq("id", id);
  if (error) throw friendlyProductError(error, name);

  await syncProductOwners(supabase, id, ownerTeamIds);

  revalidatePath("/admin/products");
  revalidatePath("/");
}

export async function deleteProduct(formData: FormData) {
  const { supabase } = await adminAction();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Product id required");
  // requests.product_id flips to null (FK ON DELETE SET NULL); product_owners
  // rows are removed by their own ON DELETE CASCADE.
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/products");
  revalidatePath("/");
}
