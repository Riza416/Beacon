import {
  DEMO_REQUESTS,
  DEMO_STATUSES,
  DEMO_TEAMS,
  DEMO_WORKSTREAMS,
  DEMO_PROJECTS,
  statusByLabel,
} from "@/lib/demo-data";
import { addDays, parseDay, toDay } from "@/lib/roadmap";
import {
  RoadmapBoard,
  type RoadmapItem,
  type RoadmapStatus,
} from "@/components/roadmap-board";

// Demo Roadmap — the real board over the fictional demo world. Dates are laid
// out relative to today so the chart always looks current, and the plan is
// arranged to show off every signal: shipped work behind the today line, a
// dependency chain, two "starts before its blocker ends" conflicts and two
// plans that land after the requester's date. One request is left
// unscheduled. Edits stay in the browser (no onSchedule).

/** [start, target] in days from today; requester's date as an offset too. */
const PLAN: Record<string, { span?: [number, number]; due?: number }> = {
  "demo-r5": { span: [-70, -35] },
  "demo-r11": { span: [-60, -20] },
  "demo-r3": { span: [-20, 10] },
  "demo-r1": { span: [-10, 30], due: 40 },
  "demo-r4": { span: [35, 70] },
  "demo-r2": { span: [5, 40] },
  "demo-r6": { span: [-15, 20], due: 25 },
  "demo-r7": { span: [22, 50] },
  "demo-r8": { span: [40, 75], due: 30 },
  "demo-r9": { span: [-5, 45] },
  "demo-r10": { span: [50, 90] },
  "demo-r12": { span: [-25, 15], due: 10 },
  "demo-r13": { span: [18, 55] },
  // demo-r14 deliberately unscheduled
};

export function DemoRoadmap() {
  // Server component: today is read once per request (see the real page).
  // eslint-disable-next-line react-hooks/purity
  const today = toDay(Date.now());
  const t0 = parseDay(today)!;
  const at = (offset: number) => toDay(addDays(t0, offset));

  const teamById = new Map(DEMO_TEAMS.map((t) => [t.id, t]));
  const wsById = new Map(DEMO_WORKSTREAMS.map((w) => [w.id, w]));
  const projectById = new Map(DEMO_PROJECTS.map((p) => [p.id, p]));

  const statuses: RoadmapStatus[] = DEMO_STATUSES.map((s) => ({
    id: s.label,
    label: s.label,
    color: s.color,
    terminal: Boolean(s.terminal),
  }));

  const items: RoadmapItem[] = DEMO_REQUESTS.map((r) => {
    const plan = PLAN[r.id] ?? {};
    const st = statusByLabel.get(r.status);
    const ws = wsById.get(r.workstreamId);
    const team = teamById.get(r.teamId);
    const project = r.projectId ? projectById.get(r.projectId) : undefined;
    return {
      id: r.id,
      title: r.title,
      href: `/requests/${r.id}`,
      status: st
        ? { id: st.label, label: st.label, color: st.color, terminal: Boolean(st.terminal) }
        : null,
      product: ws ? { id: ws.id, name: ws.name } : null,
      team: team ? { id: team.id, name: team.name } : null,
      project: project ? { id: project.id, name: project.name } : null,
      owner: null,
      author: r.author.name,
      startDate: plan.span ? at(plan.span[0]) : null,
      targetDate: plan.span ? at(plan.span[1]) : null,
      deadline: plan.due !== undefined ? at(plan.due) : null,
      supporters: 0,
      canSchedule: true,
    };
  });

  const deps = DEMO_REQUESTS.flatMap((r) =>
    (r.dependsOn ?? []).map((d) => ({ request_id: r.id, depends_on_id: d }))
  );

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
      <RoadmapBoard items={items} deps={deps} statuses={statuses} today={today} />
    </div>
  );
}
