import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

interface Row {
  id: string;
  state: string;
  submitted_at: string | null;
  acknowledged_at: string | null;
  updated_at: string;
  status_id: string | null;
  product_id: string | null;
  decline_reason: string | null;
}

const DAY = 86_400_000;

function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Human duration from milliseconds: hours under 2 days, else days. */
function fmtDur(ms: number | null): string {
  if (ms === null) return "—";
  const h = ms / 3_600_000;
  if (h < 1) return "<1h";
  if (h < 48) return `${Math.round(h)}h`;
  return `${(h / 24).toFixed(1)}d`;
}

export default async function AnalyticsPage() {
  await requireAdmin();
  const supabase = await createClient();
  const now = Date.now();

  const [{ data: statuses }, { data: products }, { data: reqData }] =
    await Promise.all([
      supabase
        .from("statuses")
        .select("id, label, color, is_terminal, is_default")
        .order("display_order", { ascending: true })
        .returns<
          {
            id: string;
            label: string;
            color: string;
            is_terminal: boolean;
            is_default: boolean;
          }[]
        >(),
      supabase
        .from("products")
        .select("id, name")
        .order("name")
        .returns<{ id: string; name: string }[]>(),
      supabase
        .from("requests")
        .select(
          "id, state, submitted_at, acknowledged_at, updated_at, status_id, product_id, decline_reason"
        )
        .eq("state", "submitted")
        .returns<Row[]>(),
    ]);

  const terminalIds = new Set(
    (statuses ?? []).filter((s) => s.is_terminal).map((s) => s.id)
  );
  const defaultId = (statuses ?? []).find((s) => s.is_default)?.id ?? null;
  const statusById = new Map((statuses ?? []).map((s) => [s.id, s]));
  const productName = new Map((products ?? []).map((p) => [p.id, p.name]));
  const rows = reqData ?? [];

  const isTerminal = (r: Row) => r.status_id !== null && terminalIds.has(r.status_id);
  const isAwaiting = (r: Row) =>
    !isTerminal(r) && (!r.status_id || r.status_id === defaultId);

  const active = rows.filter((r) => !isTerminal(r));
  const awaiting = rows.filter(isAwaiting);
  const terminal = rows.filter(isTerminal);
  const declined = terminal.filter(
    (r) => r.decline_reason && r.decline_reason.trim().length > 0
  );

  // Median time from submit → first response (acknowledged).
  const firstResponse = median(
    rows
      .filter((r) => r.acknowledged_at && r.submitted_at)
      .map(
        (r) =>
          new Date(r.acknowledged_at as string).getTime() -
          new Date(r.submitted_at as string).getTime()
      )
  );
  // Median time from submit → closed (approx: last update on a terminal row).
  const timeToClose = median(
    terminal
      .filter((r) => r.submitted_at)
      .map(
        (r) =>
          new Date(r.updated_at).getTime() -
          new Date(r.submitted_at as string).getTime()
      )
  );
  const acceptanceRate =
    terminal.length > 0
      ? Math.round(((terminal.length - declined.length) / terminal.length) * 100)
      : null;

  const oldestAwaiting = awaiting
    .map((r) =>
      r.submitted_at
        ? (now - new Date(r.submitted_at).getTime()) / DAY
        : 0
    )
    .reduce((max, d) => Math.max(max, d), 0);

  // Status distribution across active requests.
  const activeByStatus = new Map<string, number>();
  for (const r of active) {
    const key = r.status_id ?? "__none__";
    activeByStatus.set(key, (activeByStatus.get(key) ?? 0) + 1);
  }

  // Per-workstream rollup.
  interface WsAgg {
    id: string;
    name: string;
    active: number;
    awaiting: number;
    oldestAwaitingDays: number;
    closed: number;
    firstResponseMs: number[];
  }
  const wsMap = new Map<string, WsAgg>();
  const wsKey = (r: Row) => r.product_id ?? "__none__";
  for (const r of rows) {
    const key = wsKey(r);
    if (!wsMap.has(key)) {
      wsMap.set(key, {
        id: key,
        name: r.product_id
          ? productName.get(r.product_id) ?? "Unknown"
          : "No workstream",
        active: 0,
        awaiting: 0,
        oldestAwaitingDays: 0,
        closed: 0,
        firstResponseMs: [],
      });
    }
    const agg = wsMap.get(key)!;
    if (isTerminal(r)) agg.closed += 1;
    else agg.active += 1;
    if (isAwaiting(r)) {
      agg.awaiting += 1;
      const d = r.submitted_at
        ? (now - new Date(r.submitted_at).getTime()) / DAY
        : 0;
      agg.oldestAwaitingDays = Math.max(agg.oldestAwaitingDays, d);
    }
    if (r.acknowledged_at && r.submitted_at) {
      agg.firstResponseMs.push(
        new Date(r.acknowledged_at).getTime() -
          new Date(r.submitted_at).getTime()
      );
    }
  }
  const workstreams = [...wsMap.values()].sort((a, b) => b.active - a.active);

  const stats = [
    { label: "Submitted total", value: String(rows.length) },
    { label: "Active", value: String(active.length) },
    {
      label: "Awaiting triage",
      value: String(awaiting.length),
      hint:
        awaiting.length > 0
          ? `oldest ${oldestAwaiting.toFixed(0)}d`
          : undefined,
      alert: awaiting.length > 0,
    },
    { label: "Median time to first response", value: fmtDur(firstResponse) },
    { label: "Median time to close", value: fmtDur(timeToClose) },
    {
      label: "Acceptance rate",
      value: acceptanceRate === null ? "—" : `${acceptanceRate}%`,
      hint:
        terminal.length > 0
          ? `${terminal.length - declined.length}/${terminal.length} closed`
          : undefined,
    },
  ];

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Demand and responsiveness across workstreams. Drafts are excluded —
          these are submitted requests only.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p
                className={`mt-1 text-2xl font-semibold tabular-nums ${
                  s.alert ? "text-amber-600 dark:text-amber-400" : ""
                }`}
              >
                {s.value}
              </p>
              {s.hint && (
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {s.hint}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Active by status
        </h2>
        {active.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active requests.</p>
        ) : (
          <div className="space-y-2">
            {(statuses ?? [])
              .filter((s) => !s.is_terminal)
              .map((s) => {
                const n = activeByStatus.get(s.id) ?? 0;
                const pct = active.length ? (n / active.length) * 100 : 0;
                return (
                  <div key={s.id} className="flex items-center gap-3">
                    <span className="w-28 shrink-0 truncate text-sm">
                      {s.label}
                    </span>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, backgroundColor: s.color }}
                      />
                    </div>
                    <span className="w-8 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
                      {n}
                    </span>
                  </div>
                );
              })}
            {(() => {
              const n = activeByStatus.get("__none__") ?? 0;
              if (n === 0) return null;
              const pct = active.length ? (n / active.length) * 100 : 0;
              return (
                <div className="flex items-center gap-3">
                  <span className="w-28 shrink-0 truncate text-sm text-muted-foreground">
                    No status
                  </span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-muted-foreground/40"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
                    {n}
                  </span>
                </div>
              );
            })()}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          By workstream
        </h2>
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="p-3 font-medium">Workstream</th>
                  <th className="p-3 text-right font-medium">Active</th>
                  <th className="p-3 text-right font-medium">Awaiting triage</th>
                  <th className="p-3 text-right font-medium">Oldest wait</th>
                  <th className="p-3 text-right font-medium">Closed</th>
                  <th className="p-3 text-right font-medium">
                    Median 1st response
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {workstreams.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="p-6 text-center text-muted-foreground"
                    >
                      No submitted requests yet.
                    </td>
                  </tr>
                ) : (
                  workstreams.map((w) => (
                    <tr key={w.id}>
                      <td className="p-3 font-medium">{w.name}</td>
                      <td className="p-3 text-right tabular-nums">{w.active}</td>
                      <td className="p-3 text-right tabular-nums">
                        {w.awaiting > 0 ? (
                          <span className="text-amber-600 dark:text-amber-400">
                            {w.awaiting}
                          </span>
                        ) : (
                          w.awaiting
                        )}
                      </td>
                      <td className="p-3 text-right tabular-nums text-muted-foreground">
                        {w.awaiting > 0
                          ? `${w.oldestAwaitingDays.toFixed(0)}d`
                          : "—"}
                      </td>
                      <td className="p-3 text-right tabular-nums">{w.closed}</td>
                      <td className="p-3 text-right tabular-nums text-muted-foreground">
                        {fmtDur(median(w.firstResponseMs))}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
