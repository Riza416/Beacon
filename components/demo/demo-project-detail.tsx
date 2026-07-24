import Link from "next/link";
import { Users, Layers, Lock, GitBranch } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  getDemoProject,
  getDemoTeam,
  getDemoWorkstream,
  requestsInProject,
  dependenciesOfRequest,
  statusByLabel,
  type DemoRequest,
} from "@/lib/demo-data";

// Demo project detail — static fictional data only, no Supabase. Rendered from
// app/(app)/projects/[id]/page.tsx for a demo-mode admin. Layout mirrors the
// real project-detail page: header, requests grouped by owning team, and
// "Depends on:" for requests with dependencies.

export function DemoProjectDetail({ id }: { id: string }) {
  const project = getDemoProject(id);

  if (!project) {
    return (
      <Card>
        <CardContent className="p-10 text-center text-sm text-muted-foreground">
          Demo project not found.
        </CardContent>
      </Card>
    );
  }

  const requests = requestsInProject(project.id);

  // Group by owning team so the cross-team spread of a project is visible.
  const groups = new Map<string, { name: string; rows: DemoRequest[] }>();
  for (const r of requests) {
    const team = getDemoTeam(r.teamId);
    const key = team?.id ?? "__none__";
    const name = team?.name ?? "Unassigned";
    if (!groups.has(key)) groups.set(key, { name, rows: [] });
    groups.get(key)!.rows.push(r);
  }
  const grouped = Array.from(groups.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          <Link href="/projects" className="hover:underline">
            Projects
          </Link>{" "}
          /
        </p>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {project.name}
              </h1>
              {project.isPrivate && (
                <Badge variant="secondary" className="gap-1">
                  <Lock className="h-3 w-3" />
                  Private
                </Badge>
              )}
              <Badge variant="secondary">Demo</Badge>
            </div>
            <p className="max-w-2xl text-sm text-muted-foreground">
              {project.description || "No description."}
            </p>
            <p className="text-xs text-muted-foreground">
              {project.owner.email} · updated {project.updatedAt} ·{" "}
              {requests.length} request{requests.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>
      </header>

      {requests.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            No requests in this project yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {grouped.map((g) => (
            <section key={g.name} className="space-y-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-medium">{g.name}</h2>
                <Badge variant="secondary" className="tabular-nums">
                  {g.rows.length}
                </Badge>
              </div>
              <Card>
                <CardContent className="divide-y p-0">
                  {g.rows.map((r) => {
                    const status = statusByLabel.get(r.status);
                    const deps = dependenciesOfRequest(r.id);
                    const workstream = getDemoWorkstream(r.workstreamId);
                    return (
                      <div key={r.id} className="p-3 sm:px-4">
                        <div className="flex items-center gap-3">
                          <div className="min-w-0 flex-1">
                            <Link
                              href={`/requests/${r.id}`}
                              className="font-medium hover:underline"
                            >
                              {r.title}
                            </Link>
                            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Layers className="h-3 w-3" />
                              {workstream?.name ?? "No workstream"}
                              <span>·</span>
                              <span>{r.author.email}</span>
                            </p>
                          </div>
                          {status ? (
                            <Badge
                              style={{
                                backgroundColor: status.color,
                                color: "white",
                              }}
                            >
                              {status.label}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
                          )}
                        </div>
                        {deps.length > 0 && (
                          <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                            <GitBranch className="h-3 w-3" />
                            <span>Depends on:</span>
                            {deps.map((d) => (
                              <Link
                                key={d.id}
                                href={`/requests/${d.id}`}
                                className="rounded bg-muted px-1.5 py-0.5 font-medium text-foreground hover:underline"
                              >
                                {d.title}
                              </Link>
                            ))}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
