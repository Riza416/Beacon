"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adminAction, authedAction, requireTeamManager } from "@/lib/actions/utils";

// Postgres unique_violation
const UNIQUE_VIOLATION = "23505";

function friendlyTeamError(err: { code?: string; message: string }, name: string): Error {
  if (err.code === UNIQUE_VIOLATION) {
    return new Error(`A team called "${name}" already exists.`);
  }
  return new Error(err.message);
}

/** Empty / "none" select value → null; otherwise the company id. */
function parseCompanyId(formData: FormData): string | null {
  const raw = String(formData.get("company_id") ?? "").trim();
  return raw && raw !== "__none__" ? raw : null;
}

export async function createTeam(formData: FormData) {
  const { supabase } = await adminAction();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const company_id = parseCompanyId(formData);
  if (!name) throw new Error("Name is required");
  const { error } = await supabase
    .from("teams")
    .insert({ name, description, company_id });
  if (error) throw friendlyTeamError(error, name);
  revalidatePath("/admin/teams");
}

export async function updateTeam(formData: FormData) {
  const { supabase } = await adminAction();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const company_id = parseCompanyId(formData);
  if (!id) throw new Error("Team id required");
  if (!name) throw new Error("Name is required");
  const { error } = await supabase
    .from("teams")
    .update({ name, description, company_id })
    .eq("id", id);
  if (error) throw friendlyTeamError(error, name);
  revalidatePath("/admin/teams");
  revalidatePath(`/admin/teams/${id}`);
}

// --- Companies catalog ------------------------------------------------------

export async function createCompany(formData: FormData) {
  const { supabase } = await adminAction();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Company name is required");
  const { error } = await supabase.from("companies").insert({ name });
  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      throw new Error(`A company called "${name}" already exists.`);
    }
    throw new Error(error.message);
  }
  revalidatePath("/admin/teams");
}

export async function deleteCompany(formData: FormData) {
  const { supabase } = await adminAction();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Company id required");
  // FK is ON DELETE SET NULL, so teams in this company simply lose the link.
  const { error } = await supabase.from("companies").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/teams");
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
  // Clearing the team also demotes a team_admin (their scope was this team).
  const { data: target } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", profileId)
    .maybeSingle();
  const { error } = await supabase
    .from("profiles")
    .update({
      team_id: null,
      role: target?.role === "team_admin" ? "user" : target?.role,
    })
    .eq("id", profileId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/teams/${teamId}`);
  revalidatePath("/admin/teams");
}

/**
 * Global-admin only: promote a member to team_admin (of the team they're on)
 * or demote them back to user. The target must belong to the given team.
 */
export async function setMemberTeamAdmin(formData: FormData) {
  const { supabase } = await adminAction();
  const teamId = String(formData.get("teamId") ?? "");
  const profileId = String(formData.get("profileId") ?? "");
  const makeAdmin = String(formData.get("makeAdmin") ?? "") === "true";
  if (!teamId || !profileId) throw new Error("Team and profile required");

  const { data: target, error: readErr } = await supabase
    .from("profiles")
    .select("role, team_id")
    .eq("id", profileId)
    .maybeSingle();
  if (readErr) throw new Error(readErr.message);
  if (!target || target.team_id !== teamId) {
    throw new Error("That person isn't on this team.");
  }
  // Never touch a global admin's role here.
  if (target.role === "admin") {
    throw new Error("That user is a global admin.");
  }

  const { error } = await supabase
    .from("profiles")
    .update({ role: makeAdmin ? "team_admin" : "user" })
    .eq("id", profileId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/teams/${teamId}`);
}

/**
 * Set (or clear) a member's Slack member ID, used for Slack DMs. Authorized to
 * global admins and the team admin of that member's team (via requireTeamManager
 * against the member's own team). Input is trimmed; empty → null.
 */
export async function setMemberSlackId(
  profileId: string,
  slackUserId: string | null
): Promise<{ ok: true }> {
  if (!profileId) throw new Error("Profile required");

  // Resolve the member's team so we can authorize against it.
  const { supabase } = await authedAction();
  const { data: target, error: readErr } = await supabase
    .from("profiles")
    .select("team_id")
    .eq("id", profileId)
    .maybeSingle();
  if (readErr) throw new Error(readErr.message);
  if (!target?.team_id) throw new Error("That person isn't on a team.");

  const { admin } = await requireTeamManager(target.team_id);

  const trimmed = (slackUserId ?? "").trim();
  const value = trimmed.length > 0 ? trimmed : null;

  const { error } = await admin
    .from("profiles")
    .update({ slack_user_id: value })
    .eq("id", profileId);
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/teams/${target.team_id}`);
  return { ok: true };
}

