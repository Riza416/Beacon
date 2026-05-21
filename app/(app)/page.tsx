import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
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
  product_id: string | null;
  status_id: string | null;
  submitted_at: string | null;
  updated_at: string;
  notion_url: string | null;
  author_id: string;
  status: { id: string; label: string; color: string } | null;
  team: { id: string; name: string } | null;
  product: { id: string; name: string } | null;
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
  const search = await searchParams;
  return (
    <Dashboard
      profile={profile}
      teamFilter={search.team ?? ALL}
      statusFilter={search.status ?? ALL}
      authorFilter={search.author ?? ALL}
    />
  );
}

// ---------------------------------------------------------------------------
// Unified dashboard — everyone sees all requests, grouped by team and ordered
// by team_priority within each team. Admins additionally get inline controls
// (status select + ↑/↓ team-priority arrows) on each row.
// ---------------------------------------------------------------------------

async function Dashboard({
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
  const isAdmin = profile.role === "admin";

  const [
    { data: statuses },
    { data: teams },
    { data: products },
    { data: allAuthors },
  ] = await Promise.all([
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
      .from("products")
      .select("id, name")
      .order("name")
      .returns<{ id: string; name: string }[]>(),
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .returns<{ id: string; full_name: string | null; email: string | null }[]>(),
  ]);

  let baseQuery = supabase
    .from("requests")
    .select(
      "id, title, summary, state, priority, team_priority, team_id, product_id, status_id, submitted_at, updated_at, notion_url, author_id, " +
        "status:statuses(id, label, color), " +
        "team:teams!requests_team_id_fkey(id, name), " +
        "product:products(id, name), " +
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

  const { data: rawRequests } = await baseQuery
    .order("team_priority", { ascending: true })
    .order("updated_at", { ascending: false })
    .returns<RequestRowJoined[]>();

  // Hide requests whose status is configured as terminal. They stay in the DB
  // and remain visible on /requests/[id] and /requests/mine — they're just
  // dropped from the dashboard's "in flight" view so the team can focus on
  // active work. Filter applied unless the user explicitly picked a terminal
  // status via the status filter.
  const terminalStatusIds = new Set(
    (statuses ?? []).filter((s) => s.is_terminal).map((s) => s.id)
  );
  const filterIsTerminal =
    statusFilter !== ALL && terminalStatusIds.has(statusFilter);
  const requests = filterIsTerminal
    ? rawRequests
    : (rawRequests ?? []).filter(
        (r) => !r.status_id || !terminalStatusIds.has(r.status_id)
      );
  const hiddenTerminalCount =
    (rawRequests?.length ?? 0) - (requests?.length ?? 0);

  // Status count cards reflect the filtered set.
  const counts = new Map<string, number>();
  for (const r of requests ?? []) {
    const key = r.status?.label ?? "Unassigned";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  // Awaiting triage: submitted but no status set.
  const awaitingTriage = (requests ?? []).filter(
    (r) => r.state === "submitted" && !r.status_id
  );

  // Group by product. The base query is already ordered by team_priority
  // ascending, so each group preserves its priority order.
  const byProduct = new Map<string | null, RequestRowJoined[]>();
  for (const r of requests ?? []) {
    const key = r.product_id ?? null;
    const arr = byProduct.get(key) ?? [];
    arr.push(r);
    byProduct.set(key, arr);
  }
  const orderedKeys: (string | null)[] = [];
  for (const p of products ?? []) {
    if (byProduct.has(p.id)) orderedKeys.push(p.id);
  }
  if (byProduct.has(null)) orderedKeys.push(null);
  const productName = (id: string | null) =>
    id === null
      ? "No product"
      : (products ?? []).find((p) => p.id === id)?.name ?? "Unknown product";

  // Tagged-for-me + recent comments are personal sections — they always show
  // when the current user has something there, regardless of role.
  const taggedForMe = await fetchTaggedForMe(profile);
  const recentCommentsOnMine = await fetchRecentCommentsOnMyRequests(profile.id);

  // Author dropdown keeps it short — only authors who currently have at least
  // one matching request.
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
            Every request across the org, grouped by team and ordered by team
            priority.{" "}
            {isAdmin
              ? "Use the row controls to reorder priority and set status inline."
              : "Admins triage status and priority."}
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
          <RequestList
            rows={awaitingTriage}
            statuses={statuses ?? []}
            isAdmin={isAdmin}
          />
        </SectionCard>
      )}

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium">All requests by product</h2>
            <p className="text-xs text-muted-foreground">
              Sorted by priority within each product group.
            </p>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            {hasFilters && <p>Filtered ({requests?.length ?? 0} matching)</p>}
            {hiddenTerminalCount > 0 && (
              <p>
                {hiddenTerminalCount} terminal-state{" "}
                {hiddenTerminalCount === 1 ? "request" : "requests"} hidden
              </p>
            )}
          </div>
        </div>
        {orderedKeys.length === 0 ? (
          <EmptyDashboardCard hasFilters={hasFilters} />
        ) : (
          <div className="space-y-6">
            {orderedKeys.map((productId) => {
              const rows = byProduct.get(productId) ?? [];

              // Within a product, further group by team. Inside each team
              // sub-group, the rows are ordered by team_priority asc
              // (already the base query's ordering).
              const byTeamWithin = new Map<string | null, RequestRowJoined[]>();
              for (const r of rows) {
                const tk = r.team_id ?? null;
                const arr = byTeamWithin.get(tk) ?? [];
                arr.push(r);
                byTeamWithin.set(tk, arr);
              }
              const teamKeys: (string | null)[] = [];
              for (const t of teams ?? []) {
                if (byTeamWithin.has(t.id)) teamKeys.push(t.id);
              }
              if (byTeamWithin.has(null)) teamKeys.push(null);
              const teamName = (id: string | null) =>
                id === null
                  ? "Unassigned"
                  : (teams ?? []).find((t) => t.id === id)?.name ??
                    "Unknown team";

              return (
                <div key={productId ?? "no-product"} className="space-y-3">
                  <h3 className="text-base font-medium">
                    {productName(productId)}{" "}
                    <span className="text-xs font-normal text-muted-foreground/70">
                      ({rows.length})
                    </span>
                  </h3>
                  <div className="space-y-3">
                    {teamKeys.map((teamId) => {
                      const teamRows = byTeamWithin.get(teamId) ?? [];
                      return (
                        <div
                          key={teamId ?? "unassigned-team"}
                          className="space-y-2"
                        >
                          <h4 className="text-xs uppercase tracking-wide text-muted-foreground">
                            {teamName(teamId)}
                          </h4>
                          <Card>
                            <CardContent className="p-0">
                              <ul className="divide-y">
                                {teamRows.map((r, idx) => (
                                  <RequestRowItem
                                    key={r.id}
                                    row={r}
                                    statuses={statuses ?? []}
                                    position={idx + 1}
                                    isAdmin={isAdmin}
                                  />
                                ))}
                              </ul>
                            </CardContent>
                          </Card>
                        </div>
                      );
                    })}
                  </div>
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
            isAdmin={isAdmin}
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
// Shared row + section components
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
  isAdmin,
  showPosition = true,
}: {
  rows: RequestRowJoined[];
  statuses: Status[];
  compact?: boolean;
  hideControls?: boolean;
  isAdmin: boolean;
  showPosition?: boolean;
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
              position={showPosition ? idx + 1 : undefined}
              compact={compact}
              hideControls={hideControls}
              isAdmin={isAdmin}
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
  position,
  compact = false,
  hideControls = false,
  isAdmin,
}: {
  row: RequestRowJoined;
  statuses: Status[];
  position?: number;
  compact?: boolean;
  hideControls?: boolean;
  isAdmin: boolean;
}) {
  const showControls = isAdmin && !hideControls;
  return (
    <li
      className={`flex flex-wrap items-center gap-3 ${compact ? "p-3" : "p-4"}`}
    >
      {position !== undefined && (
        <span
          className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold tabular-nums text-primary"
          aria-label={`Priority ${position}`}
          title={`Priority ${position}`}
        >
          {position}
        </span>
      )}
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
          {r.team && <Badge variant="outline">{r.team.name}</Badge>}
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
          {" · "}
          {formatDate(r.updated_at)}
        </p>
      </div>
      {showControls && (
        <DashboardRowControls
          requestId={r.id}
          currentStatusId={r.status_id}
          currentPriority={r.team_priority}
          statuses={statuses}
        />
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Data fetchers
// ---------------------------------------------------------------------------

async function fetchTaggedForMe(
  profile: Profile
): Promise<RequestRowJoined[]> {
  const supabase = await createClient();

  const { data: directRows } = await supabase
    .from("request_collaborators")
    .select("request_id")
    .eq("user_id", profile.id)
    .returns<{ request_id: string }[]>();

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
        "team:teams!requests_team_id_fkey(id, name), " +
        "author:profiles!requests_author_id_fkey(full_name, email)"
    )
    .in("id", ids)
    .order("updated_at", { ascending: false })
    .returns<RequestRowJoined[]>();

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

  const { data: myRequestRows } = await supabase
    .from("requests")
    .select("id, title")
    .eq("author_id", profileId)
    .returns<{ id: string; title: string }[]>();
  const myRequestIds = (myRequestRows ?? []).map((r) => r.id);
  if (myRequestIds.length === 0) return [];

  const titleById = new Map<string, string>();
  for (const r of myRequestRows ?? []) titleById.set(r.id, r.title);

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
