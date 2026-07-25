"use server";

import { getCurrentProfile } from "@/lib/auth";
import { countUnreadTags } from "@/lib/unread";

/**
 * Unread-tag count for the notification bell. Fetched client-side after the
 * page renders so navigation never blocks on these queries (previously the
 * app layout awaited them before rendering anything).
 */
export async function getUnreadCount(): Promise<number> {
  const profile = await getCurrentProfile();
  if (!profile) return 0;
  return countUnreadTags(profile.id, profile.team_id);
}
