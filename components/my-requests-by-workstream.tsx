import Link from "next/link";
import { Layers } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LocalTime } from "@/components/local-time";
import type { MyRequestRow } from "@/components/my-requests-sortable";

export type MyWorkstreamRow = MyRequestRow & {
  product: { id: string; name: string } | null;
};

const NO_WORKSTREAM = "__none__";

/**
 * Read-only overview of the author's own requests grouped by workstream, with a
 * per-workstream status tally and each request's current status — so they can
 * see where everything they've asked for stands, at a glance.
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
    <div className="space-y-6">
      {ordered.map(([key, group]) => {
        // Tally the author's requests in this workstream by status.
        const tally = new Map<string, { color: string; n: number }>();
        for (const r of group.rows) {
          const label = r.status?.label ?? "No status";
          const color = r.status?.color ?? "#94a3b8";
          const cur = tally.get(label) ?? { color, n: 0 };
          cur.n += 1;
          tally.set(label, cur);
        }
        return (
          <section key={key} className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <Layers className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-base font-semibold tracking-tight">
                {group.name}
              </h2>
              <span className="text-xs text-muted-foreground">
                {group.rows.length}
              </span>
            </div>
            <Card>
              <CardContent className="p-0">
                <div className="flex flex-wrap gap-2 border-b p-4">
                  {[...tally.entries()].map(([label, { color, n }]) => (
                    <span
                      key={label}
                      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs"
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <span className="font-medium tabular-nums">{n}</span>
                      <span className="text-muted-foreground">{label}</span>
                    </span>
                  ))}
                </div>
                <ul className="divide-y">
                  {group.rows.map((r) => (
                    <li key={r.id} className="flex items-center gap-3 p-4">
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/requests/${r.id}`}
                          className="font-medium hover:underline"
                        >
                          {r.title || "Untitled draft"}
                        </Link>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {r.state === "draft" && "Draft · "}
                          Updated <LocalTime value={r.updated_at} />
                        </p>
                      </div>
                      {r.status ? (
                        <Badge
                          style={{
                            backgroundColor: r.status.color,
                            color: "white",
                          }}
                        >
                          {r.status.label}
                        </Badge>
                      ) : (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          No status
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </section>
        );
      })}
    </div>
  );
}
