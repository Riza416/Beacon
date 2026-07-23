import { createClient } from "@/lib/supabase/server";

/**
 * Count the unread request tags for a profile: direct user tags with no
 * `viewed_at`, plus team tags on the profile's team that the user has not
 * viewed yet. Used to drive the notification bell badge.
 */
export async function countUnreadTags(
  profileId: string,
  teamId: string | null
) {
  const supabase = await createClient();

  // 1) Direct user tags with no viewed_at.
  const { count: userUnreadRaw } = await supabase
    .from("request_collaborators")
    .select("request_id", { count: "exact", head: true })
    .eq("user_id", profileId)
    .is("viewed_at", null);
  const userUnread = userUnreadRaw ?? 0;

  if (!teamId) return userUnread;

  // 2) Team tags on my team where I have no view row yet. PostgREST doesn't
  // do anti-joins, so fetch the team-tag set and my views and diff in JS.
  // These tables are tiny (one row per (request, team) pairing) so the round
  // trip is fine.
  const { data: teamTagRows } = await supabase
    .from("request_team_tags")
    .select("request_id, team_id")
    .eq("team_id", teamId)
    .returns<{ request_id: string; team_id: string }[]>();

  if (!teamTagRows || teamTagRows.length === 0) return userUnread;

  const { data: viewRows } = await supabase
    .from("request_team_tag_views")
    .select("request_id, team_id")
    .eq("user_id", profileId)
    .eq("team_id", teamId)
    .returns<{ request_id: string; team_id: string }[]>();

  const seen = new Set(
    (viewRows ?? []).map((v) => `${v.request_id}::${v.team_id}`)
  );
  let teamUnread = 0;
  for (const r of teamTagRows) {
    if (!seen.has(`${r.request_id}::${r.team_id}`)) teamUnread += 1;
  }

  return userUnread + teamUnread;
}
