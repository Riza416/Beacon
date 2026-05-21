import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
