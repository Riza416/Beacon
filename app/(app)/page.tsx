import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DashboardRowControls } from "@/components/dashboard-row-controls";
import { formatDate } from "@/lib/utils";
import type { Status, Team } from "@/lib/types";

export const dynamic = "force-dynamic";

type RequestWithJoins = {
  id: string;
  title: string;
  summary: string | null;
  state: "draft" | "submitted";
  priority: number;
  team_priority: number;
  team_id: string | null;
  status_id: string | null;
  submitted_at: string | null;
  updated_at: string;
  notion_url: string | null;
  author_id: string;
  status: { id: string; label: string; color: string } | null;
  team: { id: string; name: string } | null;
  author: { full_name: string | null; email: string | null } | null;
};

export default async function DashboardPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const isAdmin = profile.role === "admin";

  if (!isAdmin) {
    return <UserDashboard profileId={profile.id} />;
  }
  return <AdminDashboard />;
}

async function AdminDashboard() {
  const supabase = await createClient();

  const { data: statuses } = await supabase
    .from("statuses")
    .select("*")
    .order("display_order")
    .returns<Status[]>();

  const { data: teams } = await supabase
    .from("teams")
    .select("id, name")
    .order("name")
    .returns<Pick<Team, "id" | "name">[]>();

  const { data: requests } = await supabase
    .from("requests")
    .select(
      "id, title, summary, state, priority, team_priority, team_id, status_id, submitted_at, updated_at, notion_url, author_id, " +
        "status:statuses(id, label, color), " +
        "team:teams(id, name), " +
        "author:profiles!requests_author_id_fkey(full_name, email)"
    )
    .order("team_priority", { ascending: true })
    .order("updated_at", { ascending: false })
    .returns<RequestWithJoins[]>();

  const counts = new Map<string, number>();
  for (const r of requests ?? []) {
    const key = r.status?.label ?? "Unassigned";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  // Group requests by team.
  const byTeam = new Map<string | null, RequestWithJoins[]>();
  for (const r of requests ?? []) {
    const key = r.team_id ?? null;
    const arr = byTeam.get(key) ?? [];
    arr.push(r);
    byTeam.set(key, arr);
  }

  // Order: known teams first (by configured order), then "Unassigned".
  const orderedKeys: (string | null)[] = [];
  for (const t of teams ?? []) {
    if (byTeam.has(t.id)) orderedKeys.push(t.id);
  }
  if (byTeam.has(null)) orderedKeys.push(null);

  const teamName = (id: string | null) =>
    id === null
      ? "Unassigned"
      : (teams ?? []).find((t) => t.id === id)?.name ?? "Unknown team";

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">All requests</h1>
          <p className="text-sm text-muted-foreground">
            Grouped by team, ordered by team priority. Use the arrows to
            reorder, and the dropdown to set status.
          </p>
        </div>
        <Button asChild>
          <Link href="/requests/new">New request</Link>
        </Button>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(statuses ?? []).map((s) => (
          <Card key={s.id}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: s.color }}
                />
                <span className="text-sm font-medium">{s.label}</span>
              </div>
              <p className="mt-2 text-2xl font-semibold">
                {counts.get(s.label) ?? 0}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>

      <div className="space-y-6">
        {orderedKeys.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              No requests yet.{" "}
              <Link className="underline" href="/requests/new">
                Create one
              </Link>
              .
            </CardContent>
          </Card>
        )}
        {orderedKeys.map((teamId) => {
          const rows = byTeam.get(teamId) ?? [];
          return (
            <section key={teamId ?? "unassigned"} className="space-y-3">
              <h2 className="text-lg font-medium">
                {teamName(teamId)}{" "}
                <span className="ml-1 text-sm font-normal text-muted-foreground">
                  ({rows.length})
                </span>
              </h2>
              <Card>
                <CardContent className="p-0">
                  <ul className="divide-y">
                    {rows.map((r, idx) => (
                      <li
                        key={r.id}
                        className="flex flex-wrap items-center gap-3 p-4"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link
                              href={`/requests/${r.id}`}
                              className="font-medium hover:underline"
                            >
                              {r.title || "Untitled draft"}
                            </Link>
                            {r.state === "draft" && (
                              <Badge variant="secondary">Draft</Badge>
                            )}
                            {r.status && (
                              <Badge
                                style={{
                                  backgroundColor: r.status.color,
                                  color: "white",
                                }}
                              >
                                {r.status.label}
                              </Badge>
                            )}
                            {r.notion_url && (
                              <a
                                href={r.notion_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs underline text-muted-foreground"
                              >
                                Notion ↗
                              </a>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {r.author?.email ??
                              r.author?.full_name ??
                              "Unknown"}{" "}
                            · {formatDate(r.updated_at)}
                          </p>
                        </div>
                        <DashboardRowControls
                          requestId={r.id}
                          currentStatusId={r.status_id}
                          statuses={statuses ?? []}
                          isFirstInTeam={idx === 0}
                          isLastInTeam={idx === rows.length - 1}
                        />
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </section>
          );
        })}
      </div>
    </div>
  );
}

async function UserDashboard({ profileId }: { profileId: string }) {
  const supabase = await createClient();

  const { data: mine } = await supabase
    .from("requests")
    .select(
      "id, title, summary, state, priority, team_priority, team_id, status_id, submitted_at, updated_at, notion_url, author_id, " +
        "status:statuses(id, label, color), " +
        "team:teams(id, name), " +
        "author:profiles!requests_author_id_fkey(full_name, email)"
    )
    .eq("author_id", profileId)
    .order("priority", { ascending: true })
    .order("updated_at", { ascending: false })
    .returns<RequestWithJoins[]>();

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Your requests
          </h1>
          <p className="text-sm text-muted-foreground">
            Drafts and submitted requests, in your priority order.
          </p>
        </div>
        <Button asChild>
          <Link href="/requests/new">New request</Link>
        </Button>
      </header>

      {(mine ?? []).length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Nothing here yet.{" "}
            <Link className="underline" href="/requests/new">
              Create a request
            </Link>
            .
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {(mine ?? []).map((r) => (
            <Card key={r.id}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div className="space-y-1">
                  <CardTitle>
                    <Link href={`/requests/${r.id}`} className="hover:underline">
                      {r.title || "Untitled draft"}
                    </Link>
                  </CardTitle>
                  <CardDescription className="line-clamp-2">
                    {r.summary || "No summary yet."}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {r.state === "draft" && (
                    <Badge variant="secondary">Draft</Badge>
                  )}
                  {r.status && (
                    <Badge
                      style={{
                        backgroundColor: r.status.color,
                        color: "white",
                      }}
                    >
                      {r.status.label}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-0 text-xs text-muted-foreground">
                {formatDate(r.updated_at)}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
