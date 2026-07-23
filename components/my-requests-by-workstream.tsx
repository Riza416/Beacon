import Link from "next/link";
import { Layers } from "lucide-react";
import { Card } from "@/components/ui/card";
import { LocalTime } from "@/components/local-time";
import type { MyRequestRow } from "@/components/my-requests-sortable";

export type MyWorkstreamRow = MyRequestRow & {
  product: { id: string; name: string } | null;
};

const NO_WORKSTREAM = "__none__";

/**
 * Compact overview of the author's own requests grouped by workstream — one
 * small card per workstream (like the dashboard board), with a status-mix bar
 * and each request's status, so they can see where things stand at a glance.
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
      {ordered.map(([key, group]) => (
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

          <ul className="max-h-72 flex-1 divide-y overflow-y-auto">
            {group.rows.map((r) => (
              <li key={r.id} className="flex items-center gap-2 p-3">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/requests/${r.id}`}
                    className="block truncate text-sm font-medium hover:underline"
                    title={r.title || "Untitled draft"}
                  >
                    {r.title || "Untitled draft"}
                  </Link>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {r.state === "draft" && "Draft · "}
                    <LocalTime value={r.updated_at} />
                  </p>
                </div>
                {r.status ? (
                  <span
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs"
                    style={{
                      backgroundColor: `${r.status.color}22`,
                      color: r.status.color,
                    }}
                    title={r.status.label}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: r.status.color }}
                    />
                    {r.status.label}
                  </span>
                ) : (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    No status
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </section>
  );
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
