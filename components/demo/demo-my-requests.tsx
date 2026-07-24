import Link from "next/link";
import { Calendar, Layers } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  myDemoRequests,
  getDemoWorkstream,
  statusByLabel,
  type DemoRequest,
} from "@/lib/demo-data";

// Demo "Your requests" — the demo viewer's fictional requests grouped by
// workstream. Static data only (no Supabase). Rendered from
// app/(app)/requests/mine/page.tsx for a demo-mode admin.

const NO_WORKSTREAM = "__none__";

export function DemoMyRequests() {
  const rows = myDemoRequests();

  const groups = new Map<string, { name: string; rows: DemoRequest[] }>();
  for (const r of rows) {
    const ws = getDemoWorkstream(r.workstreamId);
    const key = ws?.id ?? NO_WORKSTREAM;
    const group = groups.get(key) ?? { name: ws?.name ?? "No workstream", rows: [] };
    group.rows.push(r);
    groups.set(key, group);
  }
  const ordered = [...groups.entries()].sort((a, b) => {
    if (a[0] === NO_WORKSTREAM) return 1;
    if (b[0] === NO_WORKSTREAM) return -1;
    return a[1].name.localeCompare(b[1].name);
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              Your requests
            </h1>
            <Badge variant="secondary">Demo</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Where your requests stand, grouped by workstream.
          </p>
        </div>
        <Button asChild>
          <Link href="/requests/new">New request</Link>
        </Button>
      </header>

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

            <ol className="divide-y">
              {group.rows.map((r, idx) => {
                const st = statusByLabel.get(r.status);
                return (
                  <li key={r.id} className="flex items-center gap-3 p-3">
                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold tabular-nums text-primary">
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/requests/${r.id}`}
                        className="truncate text-sm font-medium hover:underline"
                      >
                        {r.title}
                      </Link>
                      {r.deadline && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          <span
                            className={
                              r.overdue
                                ? "inline-flex items-center gap-0.5 font-medium text-destructive"
                                : "inline-flex items-center gap-0.5"
                            }
                          >
                            <Calendar className="h-3 w-3" />
                            {r.overdue ? "overdue" : `due ${r.deadline}`}
                          </span>
                        </p>
                      )}
                    </div>
                    {st && (
                      <span
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs"
                        style={{
                          backgroundColor: `${st.color}22`,
                          color: st.color,
                        }}
                      >
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: st.color }}
                        />
                        {st.label}
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          </Card>
        ))}
      </section>
    </div>
  );
}

/** Thin segmented bar of the workstream's status mix. */
function StatusBar({ rows }: { rows: DemoRequest[] }) {
  if (rows.length === 0) return null;
  const tally = new Map<string, { color: string; n: number }>();
  for (const r of rows) {
    const st = statusByLabel.get(r.status);
    const color = st?.color ?? "#94a3b8";
    const cur = tally.get(r.status) ?? { color, n: 0 };
    cur.n += 1;
    tally.set(r.status, cur);
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
