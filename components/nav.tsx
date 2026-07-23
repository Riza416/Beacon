import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cookies } from "next/headers";
import { BeaconLogo } from "@/components/logo";
import { NotificationBell } from "@/components/notification-bell";
import { DemoModeToggle } from "@/components/demo-mode-toggle";
import { DEMO_COOKIE } from "@/lib/demo";

async function countUnreadTags(profileId: string, teamId: string | null) {
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

export default async function Nav() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const isAdmin = profile.role === "admin";
  const isTeamAdmin = profile.role === "team_admin";
  // Regular members granted any product permission get a Products link.
  const canManageTeamProducts =
    profile.team_id !== null &&
    (isTeamAdmin ||
      profile.can_create_products ||
      profile.can_edit_products ||
      profile.can_delete_products);
  const unread = await countUnreadTags(profile.id, profile.team_id);
  const demoOn = isAdmin
    ? (await cookies()).get(DEMO_COOKIE)?.value === "1"
    : false;

  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href="/" aria-label="Beacon — home">
            <BeaconLogo size={20} />
          </Link>
          <nav className="hidden gap-4 text-sm sm:flex">
            <Link href="/" className="text-muted-foreground hover:text-foreground">
              Dashboard
            </Link>
            <Link href="/requests/mine" className="text-muted-foreground hover:text-foreground">
              My requests
            </Link>
            <Link href="/requests/new" className="text-muted-foreground hover:text-foreground">
              New request
            </Link>
            <Link href="/guide" className="text-muted-foreground hover:text-foreground">
              Guide
            </Link>
            {isTeamAdmin && (
              <Link href="/team" className="text-muted-foreground hover:text-foreground">
                My team
              </Link>
            )}
            {!isAdmin && !isTeamAdmin && canManageTeamProducts && (
              <Link href="/team/products" className="text-muted-foreground hover:text-foreground">
                Workstreams
              </Link>
            )}
            {isAdmin && (
              <>
                <Link href="/admin/teams" className="text-muted-foreground hover:text-foreground">
                  Teams
                </Link>
                <Link href="/admin/products" className="text-muted-foreground hover:text-foreground">
                  Workstreams
                </Link>
                <Link href="/admin/requirements" className="text-muted-foreground hover:text-foreground">
                  Fields
                </Link>
                <Link href="/admin/statuses" className="text-muted-foreground hover:text-foreground">
                  Statuses
                </Link>
              </>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && <DemoModeToggle enabled={demoOn} />}
          <span className="hidden text-sm text-muted-foreground sm:inline">
            {profile.email ?? profile.full_name}
          </span>
          <Badge variant={isAdmin ? "default" : "secondary"}>{profile.role}</Badge>
          <NotificationBell count={unread} />
          <form action="/auth/signout" method="post">
            <Button variant="ghost" size="sm" type="submit">
              Sign out
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
