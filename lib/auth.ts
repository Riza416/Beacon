import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return (profile as Profile) ?? null;
}

export async function requireProfile(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  return profile;
}

export async function requireAdmin(): Promise<Profile> {
  const profile = await requireProfile();
  if (profile.role !== "admin") redirect("/forbidden");
  return profile;
}

/**
 * Page guard for the /team area (managing people): global admins and team
 * admins only. Team admins must be on a team. Regular users -> /forbidden.
 */
export async function requireTeamManager(): Promise<Profile> {
  const profile = await requireProfile();
  const ok =
    profile.role === "admin" ||
    (profile.role === "team_admin" && profile.team_id !== null);
  if (!ok) redirect("/forbidden");
  return profile;
}

/**
 * Page guard for /team/products: global admins, team admins, and members
 * their team admin has granted product management. Non-admins must be on a
 * team (the scope of what they can manage).
 */
export async function requireProductManager(): Promise<Profile> {
  const profile = await requireProfile();
  const hasAnyGrant =
    profile.can_create_products ||
    profile.can_edit_products ||
    profile.can_delete_products;
  const ok =
    profile.role === "admin" ||
    (profile.team_id !== null &&
      (profile.role === "team_admin" || hasAnyGrant));
  if (!ok) redirect("/forbidden");
  return profile;
}
