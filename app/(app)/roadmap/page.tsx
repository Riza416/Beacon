import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isDemoOn } from "@/lib/demo";
import { toDay } from "@/lib/roadmap";
import {
  RoadmapBoard,
  type RoadmapItem,
  type RoadmapStatus,
} from "@/components/roadmap-board";
import { DemoRoadmap } from "@/components/demo/demo-roadmap";
import { setRequestSchedule } from "./actions";

export const dynamic = "force-dynamic";

/** Enough for every live request today; a cap so a runaway table can't hang the page. */
const MAX_REQUESTS = 1000;

interface RoadmapRow {
  id: string;
  title: string;
  team_id: string | null;
  product_id: string | null;
  start_date: string | null;
  target_date: string | null;
  deadline: string | null;
  status: { id: string; label: string; color: string; is_terminal: boolean } | null;
  product: { id: string; name: string } | null;
  team: { id: string; name: string } | null;
  project: { id: string; name: string } | null;
  owner: { full_name: string | null; email: string | null } | null;
  author: { full_name: string | null; email: string | null } | null;
  supporters: { count: number }[];
}

const person = (p: { full_name: string | null; email: string | null } | null) =>
  p?.full_name?.trim() || p?.email || null;

export default async function RoadmapPage() {
  const profile = await requireProfile();
  if (await isDemoOn(profile.role)) return <DemoRoadmap />;

  const supabase = await createClient();

  // Submitted requests only — a draft isn't a commitment to anyone yet. RLS
  // already hides private requests the caller can't see, and the dependency
  // query below is filtered to the ids that survived, so a private request
  // can't leak through as a dangling link either.
  const [{ data: rows }, { data: statusRows }, { data: ownerRows }] = await Promise.all([
    supabase
      .from("requests")
      .select(
        "id, title, team_id, product_id, start_date, target_date, deadline, " +
          "status:statuses(id, label, color, is_terminal), " +
          "product:products(id, name), " +
          "team:teams!requests_team_id_fkey(id, name), " +
          "project:projects(id, name), " +
          "owner:profiles!requests_owner_id_fkey(full_name, email), " +
          "author:profiles!requests_author_id_fkey(full_name, email), " +
          "supporters:request_supporters(count)"
      )
      .eq("state", "submitted")
      .order("start_date", { ascending: true, nullsFirst: false })
      .limit(MAX_REQUESTS)
      .returns<RoadmapRow[]>(),
    supabase
      .from("statuses")
      .select("id, label, color, is_terminal, display_order")
      .order("display_order")
      .returns<
        { id: string; label: string; color: string; is_terminal: boolean }[]
      >(),
    supabase
      .from("product_owners")
      .select("product_id, team_id")
      .returns<{ product_id: string; team_id: string }[]>(),
  ]);

  const requests = rows ?? [];
  const ids = requests.map((r) => r.id);
  const { data: depRows } = ids.length
    ? await supabase
        .from("request_dependencies")
        .select("request_id, depends_on_id")
        .in("request_id", ids)
        .returns<{ request_id: string; depends_on_id: string }[]>()
    : { data: [] as { request_id: string; depends_on_id: string }[] };

  // Same rule the scheduling action enforces: admins, or a member of a team
  // that owns the request's workstream. Computing it here only decides which
  // bars are draggable — the action re-checks on every write.
  const owningTeams = new Map<string, Set<string>>();
  for (const o of ownerRows ?? []) {
    const s = owningTeams.get(o.product_id) ?? new Set<string>();
    s.add(o.team_id);
    owningTeams.set(o.product_id, s);
  }
  const canSchedule = (productId: string | null) =>
    profile.role === "admin" ||
    (productId !== null &&
      profile.team_id !== null &&
      (owningTeams.get(productId)?.has(profile.team_id) ?? false));

  const items: RoadmapItem[] = requests.map((r) => ({
    id: r.id,
    title: r.title,
    href: `/requests/${r.id}`,
    status: r.status
      ? { id: r.status.id, label: r.status.label, color: r.status.color, terminal: r.status.is_terminal }
      : null,
    product: r.product,
    team: r.team,
    project: r.project,
    owner: person(r.owner),
    author: person(r.author),
    startDate: r.start_date,
    targetDate: r.target_date,
    deadline: r.deadline,
    supporters: r.supporters?.[0]?.count ?? 0,
    canSchedule: canSchedule(r.product_id),
  }));

  const statuses: RoadmapStatus[] = (statusRows ?? []).map((s) => ({
    id: s.id,
    label: s.label,
    color: s.color,
    terminal: s.is_terminal,
  }));

  const known = new Set(ids);
  const deps = (depRows ?? []).filter(
    (d) => known.has(d.request_id) && known.has(d.depends_on_id)
  );

  // Server component on a force-dynamic page: "today" is read once per
  // request and handed to the client, so SSR and hydration agree.
  // eslint-disable-next-line react-hooks/purity
  const today = toDay(Date.now());

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Roadmap</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          When each workstream plans to deliver the requests it has taken on,
          how they depend on one another, and where a plan runs past what the
          requester asked for.
        </p>
      </header>

      <RoadmapBoard
        items={items}
        deps={deps}
        statuses={statuses}
        today={today}
        onSchedule={setRequestSchedule}
      />
    </div>
  );
}
