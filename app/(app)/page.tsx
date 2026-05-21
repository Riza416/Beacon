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
import { DashboardFilters } from "@/components/dashboard-filters";
import { formatDate } from "@/lib/utils";
import type { Profile, Status, Team } from "@/lib/types";

export const dynamic = "force-dynamic";

const ALL = "__all__";
const UNASSIGNED = "__unassigned__";

interface RequestRowJoined {
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
}

interface DashboardPageProps {
  searchParams: Promise<{
    team?: string;
    status?: string;
    author?: string;
  }>;
}

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const profile = await requireProfile();
  const isAdmin = profile.role === "admin";
  const search = await searchParams;

  if (!isAdmin) return <UserDashboard profile={profile} />;
  return (
    <AdminDashboard
      profile={profile}
      teamFilter={search.team ?? ALL}
      statusFilter={search.status ?? ALL}
      authorFilter={search.author ?? ALL}
    />
  );
}

// ---------------------------------------------------------------------------
// ADMIN DASHBOARD
// ---------------------------------------------------------------------------

async function AdminDashboard({
  profile,
  teamFilter,
  statusFilter,
  authorFilter,
}: {
  profile: Profile;
  teamFilter: string;
  statusFilter: string;
  authorFilter: string;
}) {
  const supabase = await createClient();

  const [{ data: statuses }, { data: teams }, { data: allAuthors }] =
    await Promise.all([
      supabase
        .from("statuses")
        .select("*")
        .order("display_order")
        .returns<Status[]>(),
      supabase
        .from("teams")
        .select("id, name")
        .order("name")
        .returns<Pick<Team, "id" | "name">[]>(),
      supabase
        .from("profiles")
        .select("id, full_name, email")
        .returns<{ id: string; full_name: string | null; email: string | null }[]>(),
    ]);

  // Build base query, apply filters server-side.
  let baseQuery = supabase
    .from("requests")
    .select(
      "id, title, summary, state, priority, team_priority, team_id, status_id, submitted_at, updated_at, notion_url, author_id, " +
        "status:statuses(id, label, color), " +
        "team:teams(id, name), " +
        "author:profiles!requests_author_id_fkey(full_name, email)"
    );

  if (teamFilter !== ALL) {
    baseQuery =
      teamFilter === UNASSIGNED
        ? baseQuery.is("team_id", null)
        : baseQuery.eq("team_id", teamFilter);
  }
  if (statusFilter !== ALL) {
    baseQuery =
      statusFilter === UNASSIGNED
        ? baseQuery.is("status_id", null)
        : baseQuery.eq("status_id", statusFilter);
  }
  if (authorFilter !== ALL) {
    baseQuery = baseQuery.eq("author_id", authorFilter);
  }

  const { data: requests } = await baseQuery
    .order("team_priority", { ascending: true })
    .order("updated_at", { ascending: false })
    .returns<RequestRowJoined[]>();

  // Status count cards reflect the filtered set so admins can see "for this
  // team / author, how many are In Progress?"
  const counts = new Map<string, number>();
  for (const r of requests ?? []) {
    const key = r.status?.label ?? "Unassigned";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  // Awaiting triage: submitted but no status set.
  const awaitingTriage = (requests ?? []).filter(
    (r) => r.state === "submitted" && !r.status_id
  );

  // Recently updated: last 10.
  const recentlyUpdated = [...(requests ?? [])]
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    )
    .slice(0, 10);

  // Group by team (existing behavior).
  const byTeam = new Map<string | null, RequestRowJoined[]>();
  for (const r of requests ?? []) {
    const key = r.team_id ?? null;
    const arr = byTeam.get(key) ?? [];
    arr.push(r);
    byTeam.set(key, arr);
  }
  const orderedKeys: (string | null)[] = [];
  for (const t of teams ?? []) {
    if (byTeam.has(t.id)) orderedKeys.push(t.id);
  }
  if (byTeam.has(null)) orderedKeys.push(null);
  const teamName = (id: string | null) =>
    id === null
      ? "Unassigned"
      : (teams ?? []).find((t) => t.id === id)?.name ?? "Unknown team";

  // Tagged-for-me + recent comments — admin sees them too, in case they
  // are tagged personally.
  const taggedForMe = await fetchTaggedForMe(profile);
  const recentCommentsOnMine = await fetchRecentCommentsOnMyRequests(profile.id);

  // Filter chip author dropdown — keep it short by listing authors who
  // actually have at least one request right now.
  const authorIdsWithRequests = new Set(
    (requests ?? []).map((r) => r.author_id)
  );
  const authorOptions = (allAuthors ?? [])
    .filter((a) => authorIdsWithRequests.has(a.id))
    .map((a) => ({
      id: a.id,
      label: a.full_name ?? a.email ?? "Unknown",
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const hasFilters =
    teamFilter !== ALL || statusFilter !== ALL || authorFilter !== ALL;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Everything in motion. Reorder team priority and set status inline.
          </p>
        </div>
        <Button asChild>
          <Link href="/requests/new">New request</Link>
        </Button>
      </header>

      <DashboardFilters
        teams={teams ?? []}
        statuses={(statuses ?? []).map((s) => ({
          id: s.id,
          label: s.label,
          color: s.color,
        }))}
        authors={authorOptions}
      />

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

      {awaitingTriage.length > 0 && (
        <SectionCard
          title="Awaiting triage"
          description="Submitted requests that haven't been given a status yet."
        >
          <RequestList rows={awaitingTriage} statuses={statuses ?? []} />
        </SectionCard>
      )}

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-lg font-medium">By team</h2>
          {hasFilters && (
            <p className="text-xs text-muted-foreground">
              Filtered ({requests?.length ?? 0} matching)
            </p>
          )}
        </div>
        {orderedKeys.length === 0 ? (
          <EmptyDashboardCard hasFilters={hasFilters} />
        ) : (
          <div className="space-y-6">
            {orderedKeys.map((teamId) => {
              const rows = byTeam.get(teamId) ?? [];
              return (
                <div key={teamId ?? "unassigned"} className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground">
                    {teamName(teamId)}{" "}
                    <span className="text-xs text-muted-foreground/70">
                      ({rows.length})
                    </span>
                  </h3>
                  <Card>
                    <CardContent className="p-0">
                      <ul className="divide-y">
                        {rows.map((r, idx) => (
                          <RequestRowItem
                            key={r.id}
                            row={r}
                            statuses={statuses ?? []}
                            isFirstInTeam={idx === 0}
                            isLastInTeam={idx === rows.length - 1}
                          />
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {recentlyUpdated.length > 0 && (
        <SectionCard
          title="Recently updated"
          description="Last 10 across the filtered set."
        >
          <RequestList rows={recentlyUpdated} statuses={statuses ?? []} compact />
        </SectionCard>
      )}

      {taggedForMe.length > 0 && (
        <SectionCard
          title="Tagged for your feedback"
          description="Requests where you (or your team) were tagged."
        >
          <RequestList
            rows={taggedForMe}
            statuses={statuses ?? []}
            compact
            hideControls
          />
        </SectionCard>
      )}

      {recentCommentsOnMine.length > 0 && (
        <SectionCard
          title="Recent comments on your requests"
          description="Newest comments first."
        >
          <ul className="space-y-2">
            {recentCommentsOnMine.map((c) => (
              <li
                key={c.comment_id}
                className="rounded-md border bg-muted/20 p-3 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>{c.author_label}</span>
                  <span>·</span>
                  <Link
                    className="hover:underline"
                    href={`/requests/${c.request_id}`}
                  >
                    {c.request_title}
                  </Link>
                  <span>·</span>
                  <span>{formatDate(c.created_at)}</span>
                </div>
                <p className="mt-1 line-clamp-2">{c.body}</p>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// USER DASHBOARD
// ---------------------------------------------------------------------------

async function UserDashboard({ profile }: { profile: Profile }) {
  const supabase = await createClient();

  const [{ data: statuses }, { data: mine }] = await Promise.all([
    supabase
      .from("statuses")
      .select("*")
      .order("display_order")
      .returns<Status[]>(),
    supabase
      .from("requests")
      .select(
        "id, title, summary, state, priority, team_priority, team_id, status_id, submitted_at, updated_at, notion_url, author_id, " +
          "status:statuses(id, label, color), " +
          "team:teams(id, name), " +
          "author:profiles!requests_author_id_fkey(full_name, email)"
      )
      .eq("author_id", profile.id)
      .order("priority", { ascending: true })
      .order("updated_at", { ascending: false })
      .returns<RequestRowJoined[]>(),
  ]);

  // Group my requests by status.
  const byStatus = new Map<string, RequestRowJoined[]>();
  for (const r of mine ?? []) {
    const key = r.status?.label ?? "Unassigned";
    const arr = byStatus.get(key) ?? [];
    arr.push(r);
    byStatus.set(key, arr);
  }
  const statusOrder = [
    ...(statuses ?? []).map((s) => s.label),
    ...(byStatus.has("Unassigned") ? ["Unassigned"] : []),
  ];

  const taggedForMe = await fetchTaggedForMe(profile);
  const recentCommentsOnMine = await fetchRecentCommentsOnMyRequests(profile.id);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Things in motion: your requests, what owes you feedback, and what
            people are saying.
          </p>
        </div>
        <Button asChild>
          <Link href="/requests/new">New request</Link>
        </Button>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Your requests by status</h2>
        {(mine ?? []).length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              You haven&apos;t created a request yet.{" "}
              <Link className="underline" href="/requests/new">
                Create one
              </Link>
              .
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {statusOrder.map((label) => {
              const rows = byStatus.get(label);
              if (!rows || rows.length === 0) return null;
              return (
                <div key={label} className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground">
                    {label}{" "}
                    <span className="text-xs text-muted-foreground/70">
                      ({rows.length})
                    </span>
                  </h3>
                  <Card>
                    <CardContent className="p-0">
                      <ul className="divide-y">
                        {rows.map((r) => (
                          <RequestRowItem
                            key={r.id}
                            row={r}
                            statuses={statuses ?? []}
                            isFirstInTeam={true}
                            isLastInTeam={true}
                            hideControls
                          />
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {taggedForMe.length > 0 && (
        <SectionCard
          title="Tagged for your feedback"
          description="Requests where you (or your team) were tagged."
        >
          <RequestList
            rows={taggedForMe}
            statuses={statuses ?? []}
            compact
            hideControls
          />
        </SectionCard>
      )}

      {recentCommentsOnMine.length > 0 && (
        <SectionCard
          title="Recent comments on your requests"
          description="Newest first."
        >
          <ul className="space-y-2">
            {recentCommentsOnMine.map((c) => (
              <li
                key={c.comment_id}
                className="rounded-md border bg-muted/20 p-3 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>{c.author_label}</span>
                  <span>·</span>
                  <Link
                    className="hover:underline"
                    href={`/requests/${c.request_id}`}
                  >
                    {c.request_title}
                  </Link>
                  <span>·</span>
                  <span>{formatDate(c.created_at)}</span>
                </div>
                <p className="mt-1 line-clamp-2">{c.body}</p>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers and shared row components
// ---------------------------------------------------------------------------

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-medium">{title}</h2>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}

function EmptyDashboardCard({ hasFilters }: { hasFilters: boolean }) {
  return (
    <Card>
      <CardContent className="p-8 text-center text-sm text-muted-foreground">
        {hasFilters ? (
          "No requests match the current filters."
        ) : (
          <>
            No requests yet.{" "}
            <Link className="underline" href="/requests/new">
              Create one
            </Link>
            .
          </>
        )}
      </CardContent>
    </Card>
  );
}

function RequestList({
  rows,
  statuses,
  compact = false,
  hideControls = false,
}: {
  rows: RequestRowJoined[];
  statuses: Status[];
  compact?: boolean;
  hideControls?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <ul className="divide-y">
          {rows.map((r, idx) => (
            <RequestRowItem
              key={r.id}
              row={r}
              statuses={statuses}
              isFirstInTeam={idx === 0}
              isLastInTeam={idx === rows.length - 1}
              compact={compact}
              hideControls={hideControls}
            />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function RequestRowItem({
  row: r,
  statuses,
  isFirstInTeam,
  isLastInTeam,
  compact = false,
  hideControls = false,
}: {
  row: RequestRowJoined;
  statuses: Status[];
  isFirstInTeam: boolean;
  isLastInTeam: boolean;
  compact?: boolean;
  hideControls?: boolean;
}) {
  return (
    <li
      className={`flex flex-wrap items-center gap-3 ${compact ? "p-3" : "p-4"}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/requests/${r.id}`}
            className="font-medium hover:underline"
          >
            {r.title || "Untitled draft"}
          </Link>
          {r.state === "draft" && <Badge variant="secondary">Draft</Badge>}
          {r.status && (
            <Badge
              style={{ backgroundColor: r.status.color, color: "white" }}
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
          {r.author?.email ?? r.author?.full_name ?? "Unknown"}
          {r.team && <span> · {r.team.name}</span>}
          {" · "}
          {formatDate(r.updated_at)}
        </p>
      </div>
      {!hideControls && (
        <DashboardRowControls
          requestId={r.id}
          currentStatusId={r.status_id}
          statuses={statuses}
          isFirstInTeam={isFirstInTeam}
          isLastInTeam={isLastInTeam}
        />
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Data fetchers shared by both dashboards
// ---------------------------------------------------------------------------

async function fetchTaggedForMe(
  profile: Profile
): Promise<RequestRowJoined[]> {
  const supabase = await createClient();

  // Direct collaborator tags
  const { data: directRows } = await supabase
    .from("request_collaborators")
    .select("request_id")
    .eq("user_id", profile.id)
    .returns<{ request_id: string }[]>();

  // Team tags (only when I have a team)
  let teamTaggedIds: string[] = [];
  if (profile.team_id) {
    const { data: teamRows } = await supabase
      .from("request_team_tags")
      .select("request_id")
      .eq("team_id", profile.team_id)
      .returns<{ request_id: string }[]>();
    teamTaggedIds = (teamRows ?? []).map((r) => r.request_id);
  }

  const ids = Array.from(
    new Set([
      ...(directRows ?? []).map((r) => r.request_id),
      ...teamTaggedIds,
    ])
  );

  if (ids.length === 0) return [];

  const { data: requests } = await supabase
    .from("requests")
    .select(
      "id, title, summary, state, priority, team_priority, team_id, status_id, submitted_at, updated_at, notion_url, author_id, " +
        "status:statuses(id, label, color), " +
        "team:teams(id, name), " +
        "author:profiles!requests_author_id_fkey(full_name, email)"
    )
    .in("id", ids)
    .order("updated_at", { ascending: false })
    .returns<RequestRowJoined[]>();

  // Filter out requests where I'm the author — no point flagging myself.
  return (requests ?? []).filter((r) => r.author_id !== profile.id);
}

interface RecentComment {
  comment_id: string;
  body: string;
  created_at: string;
  request_id: string;
  request_title: string;
  author_label: string;
}

async function fetchRecentCommentsOnMyRequests(
  profileId: string
): Promise<RecentComment[]> {
  const supabase = await createClient();

  // Find my requests' ids first
  const { data: myRequestRows } = await supabase
    .from("requests")
    .select("id, title")
    .eq("author_id", profileId)
    .returns<{ id: string; title: string }[]>();
  const myRequestIds = (myRequestRows ?? []).map((r) => r.id);
  if (myRequestIds.length === 0) return [];

  const titleById = new Map<string, string>();
  for (const r of myRequestRows ?? []) titleById.set(r.id, r.title);

  // Pull recent comments by anyone other than me on my requests
  const { data: comments } = await supabase
    .from("comments")
    .select(
      "id, body, created_at, request_id, author:profiles!comments_author_id_fkey(full_name, email)"
    )
    .in("request_id", myRequestIds)
    .neq("author_id", profileId)
    .order("created_at", { ascending: false })
    .limit(5)
    .returns<
      {
        id: string;
        body: string;
        created_at: string;
        request_id: string;
        author: { full_name: string | null; email: string | null } | null;
      }[]
    >();

  return (comments ?? []).map((c) => ({
    comment_id: c.id,
    body: c.body,
    created_at: c.created_at,
    request_id: c.request_id,
    request_title: titleById.get(c.request_id) ?? "Untitled",
    author_label: c.author?.full_name ?? c.author?.email ?? "Unknown",
  }));
}
