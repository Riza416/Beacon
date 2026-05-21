"use server";

import { revalidatePath } from "next/cache";
import { adminAction } from "@/lib/actions/utils";

const UNIQUE_VIOLATION = "23505";

function parseProduct(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  if (!name) throw new Error("Name required");
  return { name, description };
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

export async function createProduct(formData: FormData) {
  const { supabase } = await adminAction();
  const { name, description } = parseProduct(formData);
  const { error } = await supabase
    .from("products")
    .insert({ name, description });
  if (error) throw friendlyProductError(error, name);
  revalidatePath("/admin/products");
  revalidatePath("/");
}

export async function updateProduct(formData: FormData) {
  const { supabase } = await adminAction();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Product id required");
  const { name, description } = parseProduct(formData);
  const { error } = await supabase
    .from("products")
    .update({ name, description })
    .eq("id", id);
  if (error) throw friendlyProductError(error, name);
  revalidatePath("/admin/products");
  revalidatePath("/");
}

export async function deleteProduct(formData: FormData) {
  const { supabase } = await adminAction();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Product id required");
  // On delete, requests.product_id flips to null via the FK ON DELETE SET NULL.
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/products");
  revalidatePath("/");
}
