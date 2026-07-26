"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authedAction } from "@/lib/actions/utils";

const fullNameSchema = z.string().trim().max(120);
// A Slack member ID (e.g. U0123ABCD). Kept permissive on purpose — Slack's ID
// formats have changed before — just bounded so junk can't be stored.
const slackUserIdSchema = z.string().trim().max(40);

/**
 * Update the caller's own profile (display name + Slack member ID). Runs
 * through the user client: RLS enforces that only their own row — and only
 * these columns, never role — can change.
 */
export async function updateMyProfile(input: {
  fullName: string;
  slackUserId: string;
}): Promise<{ ok: true }> {
  const fullName = fullNameSchema.parse(input.fullName);
  const slackUserId = slackUserIdSchema.parse(input.slackUserId);
  const { supabase, profile } = await authedAction();

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName.length > 0 ? fullName : null,
      slack_user_id: slackUserId.length > 0 ? slackUserId : null,
    })
    .eq("id", profile.id);
  if (error) throw new Error(error.message);

  revalidatePath("/profile");
  return { ok: true };
}
