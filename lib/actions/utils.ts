import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth";
import type { Profile } from "@/lib/types";

export async function authedAction(): Promise<{
  supabase: Awaited<ReturnType<typeof createClient>>;
  profile: Profile;
}> {
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  return { supabase, profile };
}

export async function adminAction() {
  const ctx = await authedAction();
  if (ctx.profile.role !== "admin") {
    throw new Error("Admin only");
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// Team-admin authorization.
//
// A team_admin manages exactly their own team (profiles.team_id). Global
// admins can manage any team. These helpers are the single source of truth
// for "who may act on team X". Team-admin mutations run through the
// service-role admin client AFTER one of these checks passes, so the check
// itself is the security boundary — never call the admin client without one.
// ---------------------------------------------------------------------------

/** True if `profile` may manage the given team (global admin, or its team admin). */
export function canManageTeam(profile: Profile, teamId: string | null): boolean {
  if (profile.role === "admin") return true;
  if (profile.role === "team_admin" && teamId && profile.team_id === teamId) {
    return true;
  }
  return false;
}

// Per-operation product capabilities. Global admins and team admins always
// have all three; a regular member has each only if their team admin granted
// it. (Team scope — which products — is enforced separately by ownership.)
export function canCreateProducts(profile: Profile): boolean {
  return (
    profile.role === "admin" ||
    profile.role === "team_admin" ||
    profile.can_create_products === true
  );
}
export function canEditProducts(profile: Profile): boolean {
  return (
    profile.role === "admin" ||
    profile.role === "team_admin" ||
    profile.can_edit_products === true
  );
}
export function canDeleteProducts(profile: Profile): boolean {
  return (
    profile.role === "admin" ||
    profile.role === "team_admin" ||
    profile.can_delete_products === true
  );
}
/** May the user reach the product-management area at all (any capability)? */
export function canAccessProducts(profile: Profile): boolean {
  return (
    canCreateProducts(profile) ||
    canEditProducts(profile) ||
    canDeleteProducts(profile)
  );
}

/**
 * Authorize a mutation scoped to `teamId`. Returns the caller's profile plus a
 * service-role client for the privileged write. Throws if the caller is
 * neither a global admin nor the team's admin.
 */
export async function requireTeamManager(teamId: string | null): Promise<{
  profile: Profile;
  admin: ReturnType<typeof createAdminClient>;
}> {
  const { profile } = await authedAction();
  if (!canManageTeam(profile, teamId)) {
    throw new Error("You don't manage this team.");
  }
  return { profile, admin: createAdminClient() };
}
