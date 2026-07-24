"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  authedAction,
  canCreateProducts,
  canEditProducts,
  canDeleteProducts,
} from "@/lib/actions/utils";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/database.types";
import type { Profile } from "@/lib/types";

type DB = SupabaseClient<Database>;
const UNIQUE_VIOLATION = "23505";

function parseProduct(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  if (!name) throw new Error("Name required");
  return { name, description };
}

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

/** True if `teamId` owns the given product. */
async function teamOwnsProduct(
  admin: DB,
  teamId: string | null,
  productId: string
): Promise<boolean> {
  if (!teamId) return false;
  const { data } = await admin
    .from("product_owners")
    .select("team_id")
    .eq("product_id", productId)
    .eq("team_id", teamId)
    .maybeSingle();
  return Boolean(data);
}

/**
 * Authorize a product mutation for a specific capability and return a
 * service-role client + the caller.
 * - Global admins: always allowed (any product).
 * - Team admins + members granted THAT capability: allowed for products OWNED
 *   BY THEIR TEAM (and, on create, the product is auto-owned by their team).
 */
async function authorizeProductWrite(opts: {
  capability: "create" | "edit" | "delete";
  productId?: string;
}): Promise<{ profile: Profile; admin: DB }> {
  const { profile } = await authedAction();
  if (profile.role === "admin") {
    return { profile, admin: createAdminClient() };
  }

  const allowed =
    opts.capability === "create"
      ? canCreateProducts(profile)
      : opts.capability === "edit"
        ? canEditProducts(profile)
        : canDeleteProducts(profile);
  if (!allowed || !profile.team_id) {
    throw new Error(`You aren't allowed to ${opts.capability} products.`);
  }

  const admin = createAdminClient();
  if (opts.productId) {
    if (!(await teamOwnsProduct(admin, profile.team_id, opts.productId))) {
      throw new Error("Your team doesn't own this product.");
    }
  }
  return { profile, admin };
}

/** Replace product_owners for a product with exactly `teamIds`. */
async function syncProductOwners(
  admin: DB,
  productId: string,
  teamIds: string[]
): Promise<void> {
  const { data: existing, error: readErr } = await admin
    .from("product_owners")
    .select("team_id")
    .eq("product_id", productId);
  if (readErr) throw new Error(readErr.message);

  const current = new Set((existing ?? []).map((r) => r.team_id));
  const next = new Set(teamIds);
  const toInsert = teamIds.filter((id) => !current.has(id));
  const toDelete = [...current].filter((id) => !next.has(id));

  if (toInsert.length > 0) {
    const { error } = await admin
      .from("product_owners")
      .insert(toInsert.map((team_id) => ({ product_id: productId, team_id })));
    if (error) throw new Error(error.message);
  }
  if (toDelete.length > 0) {
    const { error } = await admin
      .from("product_owners")
      .delete()
      .eq("product_id", productId)
      .in("team_id", toDelete);
    if (error) throw new Error(error.message);
  }
}

export async function createProduct(formData: FormData) {
  const { profile, admin } = await authorizeProductWrite({ capability: "create" });
  const { name, description } = parseProduct(formData);

  const { data, error } = await admin
    .from("products")
    .insert({ name, description })
    .select("id")
    .single();
  if (error) throw friendlyProductError(error, name);

  if (profile.role === "admin") {
    // Global admin sets ownership from the multi-select.
    await syncProductOwners(admin, data.id, parseOwnerTeamIds(formData));
  } else if (profile.team_id) {
    // Team admin: the product is owned by their team.
    await syncProductOwners(admin, data.id, [profile.team_id]);
  }

  revalidatePath("/admin/products");
  revalidatePath("/team/products");
  revalidatePath("/");
}

export async function updateProduct(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Product id required");
  const { profile, admin } = await authorizeProductWrite({
    capability: "edit",
    productId: id,
  });
  const { name, description } = parseProduct(formData);

  const { error } = await admin
    .from("products")
    .update({ name, description })
    .eq("id", id);
  if (error) throw friendlyProductError(error, name);

  // Only global admins may reassign ownership; team admins keep their own.
  if (profile.role === "admin") {
    await syncProductOwners(admin, id, parseOwnerTeamIds(formData));
  }

  revalidatePath("/admin/products");
  revalidatePath("/team/products");
  revalidatePath("/");
}

export async function deleteProduct(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Product id required");
  const { admin } = await authorizeProductWrite({
    capability: "delete",
    productId: id,
  });
  // requests.product_id -> null (FK SET NULL); product_owners cascade-delete.
  const { error } = await admin.from("products").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/products");
  revalidatePath("/team/products");
  revalidatePath("/");
}
