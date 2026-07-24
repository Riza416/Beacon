import { Layers } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  WorkstreamRequestRow,
  type SnapshotField,
} from "@/components/workstream-request-row";
import type { MyRequestRow } from "@/components/my-requests-sortable";

export type MyWorkstreamRow = MyRequestRow & {
  product: { id: string; name: string } | null;
  priority: number;
  deadline: string | null;
  fields: SnapshotField[];
  /** True when this is a request you're tagged on (not one you authored). */
  tagged?: boolean;
};

const NO_WORKSTREAM = "__none__";

/**
 * Overview of the author's own requests (plus ones they're tagged on) grouped
 * by workstream — one card per workstream, laid out and behaving exactly like
 * the dashboard's Workstreams board: a status-mix bar and the shared
 * WorkstreamRequestRow (including its hover snapshot) for each request.
 */
export function MyRequestsByWorkstream({ rows }: { rows: MyWorkstreamRow[] }) {
  const groups = new Map<string, { name: string; rows: MyWorkstreamRow[] }>();
  for (const r of rows) {
    const key = r.product?.id ?? NO_WORKSTREAM;
    const group = groups.get(key) ?? {
      name: r.product?.name ?? "No workstream",
      rows: [],
    };
    group.rows.push(r);
    groups.set(key, group);
  }
  const ordered = [...groups.entries()].sort((a, b) => {
    if (a[0] === NO_WORKSTREAM) return 1;
    if (b[0] === NO_WORKSTREAM) return -1;
    return a[1].name.localeCompare(b[1].name);
  });

  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {ordered.map(([key, group]) => {
        const sorted = sortGroup(group.rows);
        return (
          <Card key={key} className="flex flex-col">
            <div className="flex items-center justify-between gap-2 border-b p-4">
              <div className="flex min-w-0 items-center gap-2">
                <Layers className="h-4 w-4 shrink-0 text-muted-foreground" />
                <h3 className="truncate text-sm font-semibold">{group.name}</h3>
              </div>
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
                {group.rows.length}
              </span>
            </div>

            <StatusBar rows={group.rows} />

            <div className="max-h-[22rem] flex-1 overflow-y-auto">
              <ol className="divide-y">
                {sorted.map((r, idx) => (
                  <WorkstreamRequestRow
                    key={r.id}
                    id={r.id}
                    position={idx + 1}
                    title={r.title || "Untitled draft"}
                    teamName={null}
                    status={
                      r.status
                        ? { label: r.status.label, color: r.status.color }
                        : null
                    }
                    deadline={r.deadline}
                    summary={r.summary}
                    fields={r.fields}
                    workstreamName={group.name}
                    tag={r.tagged ? "Tagged" : undefined}
                    isPrivate={r.is_private}
                  />
                ))}
              </ol>
            </div>
          </Card>
        );
      })}
    </section>
  );
}

/**
 * Within a workstream, authored requests come first (by priority ascending),
 * then any tagged requests (by updated_at descending).
 */
function sortGroup(rows: MyWorkstreamRow[]): MyWorkstreamRow[] {
  const authored = rows
    .filter((r) => !r.tagged)
    .sort((a, b) => a.priority - b.priority);
  const tagged = rows
    .filter((r) => r.tagged)
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
  return [...authored, ...tagged];
}

/** Thin segmented bar of the workstream's status mix (hover a segment for its count). */
function StatusBar({ rows }: { rows: MyWorkstreamRow[] }) {
  if (rows.length === 0) return null;
  const tally = new Map<string, { color: string; n: number }>();
  for (const r of rows) {
    const label = r.status?.label ?? "No status";
    const color = r.status?.color ?? "#94a3b8";
    const cur = tally.get(label) ?? { color, n: 0 };
    cur.n += 1;
    tally.set(label, cur);
  }
  return (
    <div className="flex h-1.5 w-full overflow-hidden">
      {[...tally.entries()].map(([label, { color, n }]) => (
        <div
          key={label}
          className="h-full"
          style={{ width: `${(n / rows.length) * 100}%`, backgroundColor: color }}
          title={`${label}: ${n}`}
        />
      ))}
    </div>
  );
}
