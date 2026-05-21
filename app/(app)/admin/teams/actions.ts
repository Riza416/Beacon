"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adminAction } from "@/lib/actions/utils";

// Postgres unique_violation
const UNIQUE_VIOLATION = "23505";

function friendlyTeamError(err: { code?: string; message: string }, name: string): Error {
  if (err.code === UNIQUE_VIOLATION) {
    return new Error(`A team called "${name}" already exists.`);
  }
  return new Error(err.message);
}

export async function createTeam(formData: FormData) {
  const { supabase } = await adminAction();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  if (!name) throw new Error("Name is required");
  const { error } = await supabase.from("teams").insert({ name, description });
  if (error) throw friendlyTeamError(error, name);
  revalidatePath("/admin/teams");
}

export async function updateTeam(formData: FormData) {
  const { supabase } = await adminAction();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  if (!id) throw new Error("Team id required");
  if (!name) throw new Error("Name is required");
  const { error } = await supabase
    .from("teams")
    .update({ name, description })
    .eq("id", id);
  if (error) throw friendlyTeamError(error, name);
  revalidatePath("/admin/teams");
  revalidatePath(`/admin/teams/${id}`);
}

export async function deleteTeam(formData: FormData) {
  const { supabase } = await adminAction();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Team id required");
  const { error } = await supabase.from("teams").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/teams");
  redirect("/admin/teams");
}

export async function addMemberToTeam(formData: FormData) {
  const { supabase } = await adminAction();
  const teamId = String(formData.get("teamId") ?? "");
  const profileId = String(formData.get("profileId") ?? "");
  if (!teamId || !profileId) throw new Error("Team and profile required");
  const { error } = await supabase
    .from("profiles")
    .update({ team_id: teamId })
    .eq("id", profileId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/teams/${teamId}`);
  revalidatePath("/admin/teams");
}

export async function removeMemberFromTeam(formData: FormData) {
  const { supabase } = await adminAction();
  const teamId = String(formData.get("teamId") ?? "");
  const profileId = String(formData.get("profileId") ?? "");
  if (!teamId || !profileId) throw new Error("Team and profile required");
  const { error } = await supabase
    .from("profiles")
    .update({ team_id: null })
    .eq("id", profileId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/teams/${teamId}`);
  revalidatePath("/admin/teams");
}
