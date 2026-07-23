import Link from "next/link";
import { cookies } from "next/headers";
import {
  Calendar,
  ExternalLink,
  Inbox,
  Layers,
  LayoutList,
  Plus,
} from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { DemoDashboard } from "@/components/demo-dashboard";
import {
  WorkstreamRequestRow,
  type SnapshotField,
} from "@/components/workstream-request-row";
import { DEMO_COOKIE } from "@/lib/demo";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DashboardRowControls } from "@/components/dashboard-row-controls";
import { DashboardFilters } from "@/components/dashboard-filters";
import { cn } from "@/lib/utils";
import { LocalTime } from "@/components/local-time";
import { REQUEST_CARD_SELECT } from "@/lib/queries";
import type { Profile, Status, Team } from "@/lib/types";

export const dynamic = "force-dynamic";

const ALL = "__all__";
const UNASSIGNED = "__unassigned__";
const VIEW_LIST = "list";
const VIEW_WORKSTREAMS = "workstreams";

interface RequestRowJoined {
  id: string;
  title: string;
  summary: string | null;
  state: "draft" | "submitted";
  priority: number;
  team_priority: number;
  workstream_priority: number;
  team_id: string | null;
  product_id: string | null;
  status_id: string | null;
  submitted_at: string | null;
  updated_at: string;
  notion_url: string | null;
  deadline: string | null;
  author_id: string;
  status: { id: string; label: string; color: string } | null;
  team: { id: string; name: string } | null;
  product: { id: string; name: string } | null;
  author: { full_name: string | null; email: string | null } | null;
}

interface DashboardPageProps {
  searchParams: Promise<{
    view?: string;
    team?: string;
    status?: string;
    author?: string;
    product?: string;
  }>;
}

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const profile = await requireProfile();
  const search = await searchParams;
  const view = search.view === VIEW_WORKSTREAMS ? VIEW_WORKSTREAMS : VIEW_LIST;

  // Demo mode is a global-admin-only cookie: swap the live dashboard for a
  // fictional preview. Honored only for admins, so the flag can never expose
  // demo content to a real user.
  if (profile.role === "admin") {
    const demoOn = (await cookies()).get(DEMO_COOKIE)?.value === "1";
    if (demoOn) return <DemoDashboard />;
  }

  return (
    <Dashboard
      profile={profile}
      view={view}
      teamFilter={search.team ?? ALL}
      statusFilter={search.status ?? ALL}
      authorFilter={search.author ?? ALL}
      productFilter={search.product ?? ALL}
    />
  );
}

// ---------------------------------------------------------------------------
// Unified dashboard. Two tabbed views over the same filtered dataset:
//   • List — every request, grouped by workstream and ordered by workstream
//     priority, with inline triage controls for those allowed to reorder.
//   • Workstreams — a holistic board: one card per workstream showing its
//     owning team, status mix, and full ranked backlog at a glance.
// Admins get inline status + priority controls; team admins reorder their own
// team's requester priority and any workstream their team owns.
// ---------------------------------------------------------------------------

async function Dashboard({
  profile,
  view,
  teamFilter,
  statusFilter,
  authorFilter,
  productFilter,
}: {
  profile: Profile;
  view: string;
  teamFilter: string;
  statusFilter: string;
  authorFilter: string;
  productFilter: string;
}) {
  const supabase = await createClient();
  const isAdmin = profile.role === "admin";

  const [
    { data: statuses },
    { data: teams },
    { data: products },
    { data: allAuthors },
    { data: ownerRows },
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
    supabase
      .from("product_owners")
      .select("product_id, team_id")
      .returns<{ product_id: string; team_id: string }[]>(),
  ]);

  // workstream (product) -> owning team ids. Drives who may edit a request's
  // workstream priority, and labels each workstream with its owner(s).
  const ownerTeamIdsByProduct = new Map<string, string[]>();
  for (const o of ownerRows ?? []) {
    const arr = ownerTeamIdsByProduct.get(o.product_id) ?? [];
    arr.push(o.team_id);
    ownerTeamIdsByProduct.set(o.product_id, arr);
  }
  const teamNameById = new Map<string, string>(
    (teams ?? []).map((t) => [t.id, t.name])
  );

  let baseQuery = supabase.from("requests").select(REQUEST_CARD_SELECT);

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
  if (productFilter !== ALL) {
    baseQuery =
      productFilter === UNASSIGNED
        ? baseQuery.is("product_id", null)
        : baseQuery.eq("product_id", productFilter);
  }

  const { data: rawRequests } = await baseQuery
    .order("team_priority", { ascending: true })
    .order("updated_at", { ascending: false })
    .returns<RequestRowJoined[]>();

  // Team dependencies: which other teams each request is tagged on, so a row
  // can render one badge per dependent team.
  const { data: tagRows } = await supabase
    .from("request_team_tags")
    .select("request_id, team_id")
    .returns<{ request_id: string; team_id: string }[]>();
  const tagsByRequest = new Map<string, string[]>();
  for (const t of tagRows ?? []) {
    const arr = tagsByRequest.get(t.request_id) ?? [];
    arr.push(t.team_id);
    tagsByRequest.set(t.request_id, arr);
  }

  // Hide requests whose status is configured as terminal. They stay in the DB
  // and remain visible on /requests/[id] and /requests/mine — they're just
  // dropped from the dashboard's "in flight" view. Skipped only when the user
  // explicitly picked a terminal status via the status filter.
  const terminalStatusIds = new Set(
    (statuses ?? []).filter((s) => s.is_terminal).map((s) => s.id)
  );
  const filterIsTerminal =
    statusFilter !== ALL && terminalStatusIds.has(statusFilter);
  const requests = filterIsTerminal
    ? rawRequests ?? []
    : (rawRequests ?? []).filter(
        (r) => !r.status_id || !terminalStatusIds.has(r.status_id)
      );
  const hiddenTerminalCount = (rawRequests?.length ?? 0) - requests.length;

  // Status count cards reflect the filtered set.
  const counts = new Map<string, number>();
  for (const r of requests) {
    const key = r.status_id ?? "__none__";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  // Awaiting triage: submitted but no status set.
  const awaitingTriage = requests.filter(
    (r) => r.state === "submitted" && !r.status_id
  );

  // Group sizes cap the priority inputs (you can't rank a request higher than
  // the number of requests in its group). Counted from the ACTIVE set
  // (`requests`, terminal-hidden) to match the ranking, which excludes
  // completed requests — so "#k of N" reflects only live work.
  const requesterGroupSize = new Map<string, number>();
  const workstreamGroupSize = new Map<string, number>();
  const requesterKey = (teamId: string | null, productId: string | null) =>
    `${teamId ?? "none"}::${productId ?? "none"}`;
  for (const r of requests) {
    const rk = requesterKey(r.team_id, r.product_id);
    requesterGroupSize.set(rk, (requesterGroupSize.get(rk) ?? 0) + 1);
    if (r.product_id) {
      workstreamGroupSize.set(
        r.product_id,
        (workstreamGroupSize.get(r.product_id) ?? 0) + 1
      );
    }
  }

  // Group by workstream (product). Each workstream group is ONE flat list
  // ordered by workstream_priority ascending (all requesting teams mixed
  // together), then updated_at descending as a tie-break. The "No workstream"
  // group has no workstream rank, so it's ordered by updated_at descending.
  const byProduct = new Map<string | null, RequestRowJoined[]>();
  for (const r of requests) {
    const key = r.product_id ?? null;
    const arr = byProduct.get(key) ?? [];
    arr.push(r);
    byProduct.set(key, arr);
  }
  for (const [key, arr] of byProduct.entries()) {
    if (key === null) {
      arr.sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
    } else {
      arr.sort(
        (a, b) =>
          a.workstream_priority - b.workstream_priority ||
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
    }
  }
  const orderedKeys: (string | null)[] = [];
  for (const p of products ?? []) {
    if (byProduct.has(p.id)) orderedKeys.push(p.id);
  }
  if (byProduct.has(null)) orderedKeys.push(null);
  const productName = (id: string | null) =>
    id === null
      ? "No workstream"
      : (products ?? []).find((p) => p.id === id)?.name ?? "Unknown workstream";

  // Workstreams board hover snapshot: the filled custom-field values
  // (Requirements, Value, …) per request. Only needed for that view.
  const snapshotFieldsByRequest =
    view === VIEW_WORKSTREAMS
      ? await fetchSnapshotFields(
          supabase,
          requests.map((r) => r.id)
        )
      : new Map<string, SnapshotField[]>();

  // Tagged-for-me + recent comments are personal sections — they always show
  // when the current user has something there, regardless of role.
  const taggedForMe = await fetchTaggedForMe(profile);
  const recentCommentsOnMine = await fetchRecentCommentsOnMyRequests(profile.id);

  // Author dropdown keeps it short — only authors who currently have at least
  // one matching request.
  const authorIdsWithRequests = new Set(requests.map((r) => r.author_id));
  const authorOptions = (allAuthors ?? [])
    .filter((a) => authorIdsWithRequests.has(a.id))
    .map((a) => ({ id: a.id, label: a.full_name ?? a.email ?? "Unknown" }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const hasFilters =
    teamFilter !== ALL ||
    statusFilter !== ALL ||
    authorFilter !== ALL ||
    productFilter !== ALL;

  // Build hrefs that preserve the active filters while flipping one param.
  // Used by the view tabs and the clickable status summary cards, so both
  // stay pure server-rendered links (no extra client bundle).
  const currentParams: Record<string, string> = {
    view,
    team: teamFilter,
    status: statusFilter,
    author: authorFilter,
    product: productFilter,
  };
  const hrefWith = (patch: Record<string, string>) => {
    const merged = { ...currentParams, ...patch };
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) {
      if (v && v !== ALL && !(k === "view" && v === VIEW_LIST)) p.set(k, v);
    }
    const qs = p.toString();
    return qs ? `/?${qs}` : "/";
  };

  const rowShared = {
    statuses: statuses ?? [],
    isAdmin,
    profile,
    ownerTeamIdsByProduct,
    requesterGroupSize,
    workstreamGroupSize,
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {view === VIEW_WORKSTREAMS
              ? "Every workstream's backlog and ranking, side by side."
              : "Every request across the org, ranked within its workstream."}{" "}
            {isAdmin
              ? "Use the row controls to reorder priority and set status inline."
              : profile.role === "team_admin"
                ? "Reorder priority inline on your team's requests; admins set status."
                : "Admins and team admins triage priority and status."}
          </p>
        </div>
        <Button asChild>
          <Link href="/requests/new">
            <Plus className="mr-1 h-4 w-4" />
            New request
          </Link>
        </Button>
      </header>

      <ViewTabs
        view={view}
        listHref={hrefWith({ view: VIEW_LIST })}
        workstreamsHref={hrefWith({ view: VIEW_WORKSTREAMS })}
      />

      <DashboardFilters
        teams={teams ?? []}
        statuses={(statuses ?? []).map((s) => ({
          id: s.id,
          label: s.label,
          color: s.color,
        }))}
        authors={authorOptions}
        products={products ?? []}
      />

      {view === VIEW_WORKSTREAMS ? (
        <WorkstreamsBoard
          orderedKeys={orderedKeys}
          byProduct={byProduct}
          productName={productName}
          statuses={statuses ?? []}
          ownerTeamIdsByProduct={ownerTeamIdsByProduct}
          teamNameById={teamNameById}
          snapshotFieldsByRequest={snapshotFieldsByRequest}
          hasFilters={hasFilters}
        />
      ) : (
        <>
          <StatusSummary
            statuses={statuses ?? []}
            counts={counts}
            statusFilter={statusFilter}
            hrefWith={hrefWith}
          />

          {awaitingTriage.length > 0 && (
            <SectionCard
              icon={<Inbox className="h-4 w-4" />}
              title="Awaiting triage"
              description="Submitted requests that haven't been given a status yet."
            >
              <RequestList rows={awaitingTriage} {...rowShared} />
            </SectionCard>
          )}

          <section className="space-y-3">
            <div className="flex items-end justify-between gap-3">
              <div className="flex items-center gap-2">
                <LayoutList className="h-4 w-4 text-muted-foreground" />
                <div>
                  <h2 className="text-lg font-medium leading-tight">
                    All requests by workstream
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Ranked by workstream priority within each group.
                  </p>
                </div>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                {hasFilters && <p>Filtered ({requests.length} matching)</p>}
                {hiddenTerminalCount > 0 && (
                  <p>
                    {hiddenTerminalCount} completed{" "}
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
                  return (
                    <div key={productId ?? "no-product"} className="space-y-2">
                      <div className="flex items-center gap-2 px-1">
                        <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                        <h3 className="text-sm font-semibold">
                          {productName(productId)}
                        </h3>
                        <span className="text-xs text-muted-foreground">
                          {rows.length}
                        </span>
                        <WorkstreamOwners
                          productId={productId}
                          ownerTeamIdsByProduct={ownerTeamIdsByProduct}
                          teamNameById={teamNameById}
                        />
                      </div>
                      <Card>
                        <CardContent className="p-0">
                          <ul className="divide-y">
                            {rows.map((r) => (
                              <RequestRowItem
                                key={r.id}
                                row={r}
                                position={
                                  productId === null
                                    ? undefined
                                    : r.workstream_priority + 1
                                }
                                taggedTeams={(tagsByRequest.get(r.id) ?? [])
                                  .flatMap((tid) => {
                                    const name = teamNameById.get(tid);
                                    return name ? [{ id: tid, name }] : [];
                                  })}
                                {...rowShared}
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
                isAdmin={isAdmin}
                profile={profile}
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
                      <LocalTime value={c.created_at} />
                    </div>
                    <p className="mt-1 line-clamp-2">{c.body}</p>
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// View tabs — pure links so switching views is a normal navigation that keeps
// the active filters in the query string.
// ---------------------------------------------------------------------------

function ViewTabs({
  view,
  listHref,
  workstreamsHref,
}: {
  view: string;
  listHref: string;
  workstreamsHref: string;
}) {
  const tabs = [
    { key: VIEW_LIST, href: listHref, label: "List", icon: LayoutList },
    {
      key: VIEW_WORKSTREAMS,
      href: workstreamsHref,
      label: "Workstreams",
      icon: Layers,
    },
  ];
  return (
    <div className="flex items-center gap-1 border-b">
      {tabs.map((t) => {
        const active = view === t.key;
        const Icon = t.icon;
        return (
          <Link
            key={t.key}
            href={t.href}
            className={cn(
              "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
            aria-current={active ? "page" : undefined}
          >
            <Icon className="h-4 w-4" />
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status summary — clickable cards that double as a one-tap status filter.
// ---------------------------------------------------------------------------

function StatusSummary({
  statuses,
  counts,
  statusFilter,
  hrefWith,
}: {
  statuses: Status[];
  counts: Map<string, number>;
  statusFilter: string;
  hrefWith: (patch: Record<string, string>) => string;
}) {
  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {statuses.map((s) => {
        const active = statusFilter === s.id;
        return (
          <Link
            key={s.id}
            href={hrefWith({ status: active ? ALL : s.id })}
            aria-pressed={active}
            title={active ? `Clear ${s.label} filter` : `Filter by ${s.label}`}
          >
            <Card
              className={cn(
                "transition-colors hover:border-primary/50 hover:bg-muted/40",
                active && "border-primary ring-1 ring-primary/30"
              )}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="text-sm font-medium">{s.label}</span>
                </div>
                <p className="mt-2 text-2xl font-semibold tabular-nums">
                  {counts.get(s.id) ?? 0}
                </p>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Workstreams board — one card per workstream, holistic view of every backlog.
// ---------------------------------------------------------------------------

function WorkstreamsBoard({
  orderedKeys,
  byProduct,
  productName,
  statuses,
  ownerTeamIdsByProduct,
  teamNameById,
  snapshotFieldsByRequest,
  hasFilters,
}: {
  orderedKeys: (string | null)[];
  byProduct: Map<string | null, RequestRowJoined[]>;
  productName: (id: string | null) => string;
  statuses: Status[];
  ownerTeamIdsByProduct: Map<string, string[]>;
  teamNameById: Map<string, string>;
  snapshotFieldsByRequest: Map<string, SnapshotField[]>;
  hasFilters: boolean;
}) {
  if (orderedKeys.length === 0) {
    return <EmptyDashboardCard hasFilters={hasFilters} />;
  }
  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {orderedKeys.map((productId) => {
        const rows = byProduct.get(productId) ?? [];
        const sequenced = productId !== null;
        return (
          <Card key={productId ?? "no-product"} className="flex flex-col">
            <div className="flex items-start justify-between gap-2 border-b p-4">
              <div className="min-w-0 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <h3 className="truncate text-sm font-semibold">
                    {productName(productId)}
                  </h3>
                </div>
                <WorkstreamOwners
                  productId={productId}
                  ownerTeamIdsByProduct={ownerTeamIdsByProduct}
                  teamNameById={teamNameById}
                />
              </div>
              <span
                className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground"
                title={`${rows.length} active ${rows.length === 1 ? "request" : "requests"}`}
              >
                {rows.length}
              </span>
            </div>

            <StatusBar rows={rows} statuses={statuses} />

            <div className="max-h-[22rem] flex-1 overflow-y-auto">
              {rows.length === 0 ? (
                <p className="p-4 text-xs text-muted-foreground">
                  No active requests.
                </p>
              ) : (
                <ol className="divide-y">
                  {rows.map((r, idx) => (
                    <WorkstreamRequestRow
                      key={r.id}
                      id={r.id}
                      position={sequenced ? idx + 1 : null}
                      title={r.title || "Untitled draft"}
                      teamName={r.team?.name ?? null}
                      status={
                        r.status
                          ? { label: r.status.label, color: r.status.color }
                          : null
                      }
                      deadline={r.deadline}
                      summary={r.summary}
                      fields={snapshotFieldsByRequest.get(r.id) ?? []}
                      workstreamName={productName(productId)}
                    />
                  ))}
                </ol>
              )}
            </div>
          </Card>
        );
      })}
    </section>
  );
}

/** A thin segmented bar showing the status mix of a workstream's requests. */
function StatusBar({
  rows,
  statuses,
}: {
  rows: RequestRowJoined[];
  statuses: Status[];
}) {
  if (rows.length === 0) return null;
  const byStatus = new Map<string | null, number>();
  for (const r of rows) {
    const key = r.status?.id ?? null;
    byStatus.set(key, (byStatus.get(key) ?? 0) + 1);
  }
  const segments = [
    ...statuses
      .filter((s) => byStatus.has(s.id))
      .map((s) => ({ label: s.label, color: s.color, n: byStatus.get(s.id)! })),
    ...(byStatus.has(null)
      ? [
          {
            label: "No status",
            color: "hsl(var(--muted-foreground))",
            n: byStatus.get(null)!,
          },
        ]
      : []),
  ];
  return (
    <div className="flex h-1.5 w-full overflow-hidden">
      {segments.map((seg, i) => (
        <div
          key={i}
          className="h-full"
          style={{
            width: `${(seg.n / rows.length) * 100}%`,
            backgroundColor: seg.color,
          }}
          title={`${seg.label}: ${seg.n}`}
        />
      ))}
    </div>
  );
}

/** Owning-team badges for a workstream (or a muted note when unowned). */
function WorkstreamOwners({
  productId,
  ownerTeamIdsByProduct,
  teamNameById,
}: {
  productId: string | null;
  ownerTeamIdsByProduct: Map<string, string[]>;
  teamNameById: Map<string, string>;
}) {
  if (productId === null) return null;
  const owners = (ownerTeamIdsByProduct.get(productId) ?? [])
    .map((id) => teamNameById.get(id))
    .filter((n): n is string => Boolean(n));
  if (owners.length === 0) {
    return (
      <span className="text-xs text-muted-foreground/70">No owning team</span>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="text-xs text-muted-foreground">Owned by</span>
      {owners.map((name) => (
        <Badge key={name} variant="secondary" className="text-[10px]">
          {name}
        </Badge>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared row + section components
// ---------------------------------------------------------------------------

function SectionCard({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        <div>
          <h2 className="text-lg font-medium leading-tight">{title}</h2>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}

function EmptyDashboardCard({ hasFilters }: { hasFilters: boolean }) {
  return (
    <Card>
      <CardContent className="p-10 text-center text-sm text-muted-foreground">
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
  profile,
  showPosition = true,
  ownerTeamIdsByProduct,
  requesterGroupSize,
  workstreamGroupSize,
}: {
  rows: RequestRowJoined[];
  statuses: Status[];
  compact?: boolean;
  hideControls?: boolean;
  isAdmin: boolean;
  profile: Profile;
  showPosition?: boolean;
  ownerTeamIdsByProduct?: Map<string, string[]>;
  requesterGroupSize?: Map<string, number>;
  workstreamGroupSize?: Map<string, number>;
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
              profile={profile}
              ownerTeamIdsByProduct={ownerTeamIdsByProduct}
              requesterGroupSize={requesterGroupSize}
              workstreamGroupSize={workstreamGroupSize}
            />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function initials(label: string): string {
  const parts = label.split(/[\s@._-]+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "?";
  const second = parts.length > 1 ? parts[1][0] : "";
  return (first + second).toUpperCase();
}

function RequestRowItem({
  row: r,
  statuses,
  position,
  compact = false,
  hideControls = false,
  isAdmin,
  profile,
  taggedTeams = [],
  ownerTeamIdsByProduct,
  requesterGroupSize,
  workstreamGroupSize,
}: {
  row: RequestRowJoined;
  statuses: Status[];
  position?: number;
  compact?: boolean;
  hideControls?: boolean;
  isAdmin: boolean;
  profile: Profile;
  /** Teams tagged on this request as dependencies (excluding the owner). */
  taggedTeams?: { id: string; name: string }[];
  /** workstream (product) id -> owning team ids, for workstream-edit rights. */
  ownerTeamIdsByProduct?: Map<string, string[]>;
  /** (team::product) -> count, caps the requester priority input. */
  requesterGroupSize?: Map<string, number>;
  /** product id -> count, caps the workstream priority input. */
  workstreamGroupSize?: Map<string, number>;
}) {
  // Global admins can edit everything. A team admin can reorder the requester
  // priority on their own team's rows (server-enforced in setTeamPriority) and
  // the workstream priority on any workstream their team owns; they never set
  // status. Dependency / read-only rows never show controls.
  const canEditStatus = isAdmin;
  const canEditRequester =
    isAdmin ||
    (profile.role === "team_admin" && r.team_id === profile.team_id);
  const canEditWorkstream =
    isAdmin ||
    (profile.role === "team_admin" &&
      r.product_id != null &&
      (ownerTeamIdsByProduct?.get(r.product_id)?.includes(
        profile.team_id ?? ""
      ) ??
        false));
  const showControls =
    (canEditRequester || canEditWorkstream || canEditStatus) && !hideControls;
  const authorLabel = r.author?.full_name ?? r.author?.email ?? "Unknown";
  const overdue = r.deadline ? new Date(r.deadline) < new Date() : false;
  return (
    <li
      className={cn(
        "flex flex-wrap items-center gap-3 transition-colors hover:bg-muted/30",
        compact ? "p-3" : "p-4"
      )}
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
            <Badge style={{ backgroundColor: r.status.color, color: "white" }}>
              {r.status.label}
            </Badge>
          )}
          {r.team && (
            <Badge variant="default" title={`Owned by ${r.team.name}`}>
              {r.team.name}
            </Badge>
          )}
          {taggedTeams
            .filter((t) => t.id !== r.team?.id)
            .map((t) => (
              <Badge
                key={`dep-${t.id}`}
                variant="outline"
                className="border-primary/50 text-primary/90"
                title={`${t.name} is tagged as a dependency`}
              >
                {t.name}
              </Badge>
            ))}
          {r.notion_url && (
            <a
              href={r.notion_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-xs text-muted-foreground underline"
            >
              Notion
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
          <span
            aria-hidden
            className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-muted text-[9px] font-semibold text-muted-foreground"
          >
            {initials(authorLabel)}
          </span>
          <span className="truncate">{authorLabel}</span>
          <span>·</span>
          <LocalTime value={r.updated_at} />
          {r.deadline && (
            <>
              <span>·</span>
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 font-medium",
                  overdue && "text-destructive"
                )}
                title="Deadline"
              >
                <Calendar className="h-3 w-3" />
                due <LocalTime value={r.deadline} mode="date" />
              </span>
            </>
          )}
        </p>
      </div>
      {showControls && (
        <DashboardRowControls
          requestId={r.id}
          currentStatusId={r.status_id}
          currentPriority={r.team_priority}
          currentWorkstreamPriority={r.workstream_priority}
          requesterMax={
            requesterGroupSize?.get(
              `${r.team_id ?? "none"}::${r.product_id ?? "none"}`
            ) ?? 1
          }
          workstreamMax={
            r.product_id ? workstreamGroupSize?.get(r.product_id) ?? 1 : 1
          }
          statuses={statuses}
          canEditStatus={canEditStatus}
          canEditRequester={canEditRequester}
          canEditWorkstream={canEditWorkstream}
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
      "id, title, summary, state, priority, team_priority, team_id, status_id, submitted_at, updated_at, notion_url, deadline, author_id, " +
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

// ---------------------------------------------------------------------------
// Workstreams board hover-snapshot: a request's filled custom-field values
// (Requirements, Value, …), keyed by request id.
// ---------------------------------------------------------------------------

function formatSnapshotValue(
  type: string,
  valueText: string | null
): { text: string } | { chips: string[] } | null {
  if (type === "multi_select") {
    if (!valueText) return null;
    try {
      const arr = JSON.parse(valueText);
      const chips = Array.isArray(arr)
        ? arr.filter((x): x is string => typeof x === "string")
        : [];
      return chips.length ? { chips } : null;
    } catch {
      return null;
    }
  }
  if (type === "checkbox") return valueText === "true" ? { text: "Yes" } : null;
  // Files/images (no text) and the owner-set repo link aren't author content.
  if (type === "file" || type === "image" || type === "repo") return null;
  const t = (valueText ?? "").trim();
  return t.length > 0 ? { text: t } : null;
}

async function fetchSnapshotFields(
  supabase: Awaited<ReturnType<typeof createClient>>,
  requestIds: string[]
): Promise<Map<string, SnapshotField[]>> {
  const map = new Map<string, SnapshotField[]>();
  if (requestIds.length === 0) return map;

  const { data } = await supabase
    .from("request_field_values")
    .select(
      "request_id, field_type, value_text, definition:request_field_definitions(label)"
    )
    .in("request_id", requestIds)
    .returns<
      {
        request_id: string;
        field_type: string;
        value_text: string | null;
        definition: { label: string } | null;
      }[]
    >();

  for (const row of data ?? []) {
    if (!row.definition) continue;
    const formatted = formatSnapshotValue(row.field_type, row.value_text);
    if (!formatted) continue;
    const arr = map.get(row.request_id) ?? [];
    arr.push({ label: row.definition.label, ...formatted });
    map.set(row.request_id, arr);
  }
  return map;
}
