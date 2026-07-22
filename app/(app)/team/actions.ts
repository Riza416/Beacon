"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authedAction, requireTeamManager } from "@/lib/actions/utils";

const emailSchema = z.string().trim().email().max(320);
const uuidSchema = z.string().uuid();
// Restrict to Slack's incoming-webhook host — both validation and an SSRF
// guard, since the server POSTs to whatever URL is stored here.
const slackWebhookSchema = z
  .string()
  .trim()
  .url()
  .max(500)
  .refine((u) => u.startsWith("https://hooks.slack.com/"), {
    message: "Enter a Slack incoming-webhook URL (https://hooks.slack.com/…)",
  });

function generateTempPassword(): string {
  // Readable, shareable one-time password: Beacon-XXXXXXXXXXXX
  return `Beacon-${randomBytes(9).toString("base64url")}`;
}

/**
 * Invite a brand-new person to a team: create a confirmed account with a
 * temporary password (no email dependency) and assign them to the team as a
 * regular user. Returns the temp password once so the inviter can share it.
 * Authorized for the team's admin or a global admin.
 */
export async function inviteUserToTeam(
  teamId: string,
  email: string
): Promise<{ ok: true; email: string; tempPassword: string }> {
  const tId = uuidSchema.parse(teamId);
  const parsedEmail = emailSchema.parse(email).toLowerCase();
  const { admin } = await requireTeamManager(tId);

  const tempPassword = generateTempPassword();

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: parsedEmail,
    password: tempPassword,
    email_confirm: true,
  });
  if (createErr || !created?.user) {
    // Most common: the email is already registered.
    throw new Error(
      createErr?.message?.includes("already")
        ? "That email already has an account. Use “Add existing member” instead."
        : createErr?.message ?? "Could not create the account."
    );
  }

  // The handle_new_user trigger created the profile row; assign the team.
  // Keep role = 'user' (never mint an admin via invite).
  const { error: updErr } = await admin
    .from("profiles")
    .update({ team_id: tId, role: "user" })
    .eq("id", created.user.id);
  if (updErr) throw new Error(updErr.message);

  revalidatePath("/team");
  revalidatePath("/admin/teams");
  return { ok: true, email: parsedEmail, tempPassword };
}

/** Assign an existing user (any / no team) to this team. */
export async function addExistingMember(
  teamId: string,
  profileId: string
): Promise<{ ok: true }> {
  const tId = uuidSchema.parse(teamId);
  const pId = uuidSchema.parse(profileId);
  const { admin } = await requireTeamManager(tId);

  const { error } = await admin
    .from("profiles")
    .update({ team_id: tId })
    .eq("id", pId);
  if (error) throw new Error(error.message);

  revalidatePath("/team");
  revalidatePath("/admin/teams");
  return { ok: true };
}

/**
 * Remove a member from this team. If they were a team_admin, demote them to
 * user (their admin scope was this team). A team admin cannot remove
 * themselves via this path — that would strand the team.
 */
export async function removeMember(
  teamId: string,
  profileId: string
): Promise<{ ok: true }> {
  const tId = uuidSchema.parse(teamId);
  const pId = uuidSchema.parse(profileId);
  const { profile, admin } = await requireTeamManager(tId);

  if (profile.role === "team_admin" && profile.id === pId) {
    throw new Error("You can't remove yourself from the team you manage.");
  }

  // Read the target's current role so we can demote a team_admin on removal.
  const { data: target, error: readErr } = await admin
    .from("profiles")
    .select("role, team_id")
    .eq("id", pId)
    .maybeSingle();
  if (readErr) throw new Error(readErr.message);
  if (!target || target.team_id !== tId) {
    throw new Error("That person isn't on this team.");
  }

  const { error } = await admin
    .from("profiles")
    .update({
      team_id: null,
      role: target.role === "team_admin" ? "user" : target.role,
    })
    .eq("id", pId);
  if (error) throw new Error(error.message);

  revalidatePath("/team");
  revalidatePath("/admin/teams");
  return { ok: true };
}

/**
 * Team admin (or global admin) grants/revokes a member's product permissions,
 * as three independent capabilities (create / edit / delete). The target must
 * be on the manager's team. team_admins and global admins always have all
 * three, so this is meant for regular members.
 */
export async function setMemberProductPermissions(
  profileId: string,
  perms: { create: boolean; edit: boolean; delete: boolean }
): Promise<{ ok: true }> {
  const pId = uuidSchema.parse(profileId);
  const { supabase } = await authedAction();

  // Resolve the target's team (reads are open) to know which team to authorize
  // against, then require that the caller manages that team.
  const { data: target, error: readErr } = await supabase
    .from("profiles")
    .select("team_id")
    .eq("id", pId)
    .maybeSingle();
  if (readErr) throw new Error(readErr.message);
  if (!target?.team_id) throw new Error("That person isn't on a team.");

  const { admin } = await requireTeamManager(target.team_id);
  const { error } = await admin
    .from("profiles")
    .update({
      can_create_products: perms.create,
      can_edit_products: perms.edit,
      can_delete_products: perms.delete,
    })
    .eq("id", pId);
  if (error) throw new Error(error.message);

  revalidatePath("/team");
  return { ok: true };
}

/** Candidate users a manager can add to their team (unassigned or other team). */
export async function searchAddableUsers(
  teamId: string
): Promise<{ id: string; full_name: string | null; email: string | null }[]> {
  const tId = uuidSchema.parse(teamId);
  // Any authenticated user can read profiles (RLS); this just scopes the list.
  const { supabase } = await authedAction();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email, team_id")
    .order("full_name", { ascending: true, nullsFirst: false });
  return (data ?? [])
    .filter((p) => p.team_id !== tId)
    .map((p) => ({ id: p.id, full_name: p.full_name, email: p.email }));
}

/**
 * Set or clear a team's Slack incoming-webhook (empty string clears it). The
 * webhook is a secret stored with admin-only RLS; this runs through the
 * service-role client after requireTeamManager. Never returns the URL.
 */
export async function setTeamSlackWebhook(
  teamId: string,
  webhookUrl: string
): Promise<{ ok: true; configured: boolean }> {
  const tId = uuidSchema.parse(teamId);
  const { admin } = await requireTeamManager(tId);
  const trimmed = webhookUrl.trim();

  if (trimmed.length === 0) {
    const { error } = await admin
      .from("team_slack_webhooks")
      .delete()
      .eq("team_id", tId);
    if (error) throw new Error(error.message);
    revalidatePath("/team");
    return { ok: true, configured: false };
  }

  const url = slackWebhookSchema.parse(trimmed);
  const { error } = await admin
    .from("team_slack_webhooks")
    .upsert(
      { team_id: tId, webhook_url: url, updated_at: new Date().toISOString() },
      { onConflict: "team_id" }
    );
  if (error) throw new Error(error.message);
  revalidatePath("/team");
  return { ok: true, configured: true };
}

/** Whether a team has a Slack webhook configured. Never returns the secret. */
export async function teamSlackConfigured(teamId: string): Promise<boolean> {
  const tId = uuidSchema.parse(teamId);
  const { admin } = await requireTeamManager(tId);
  const { count, error } = await admin
    .from("team_slack_webhooks")
    .select("team_id", { count: "exact", head: true })
    .eq("team_id", tId);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}
