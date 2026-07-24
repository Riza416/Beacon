import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, Users, Layers } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LocalTime } from "@/components/local-time";
import { ProjectDialog } from "../_components/project-dialog";
import { DeleteProjectButton } from "../_components/delete-project-button";
import { AttachRequestControl } from "../_components/attach-request-control";
import { DetachRequestButton } from "../_components/detach-request-button";

export const dynamic = "force-dynamic";

interface ProjectRow {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  updated_at: string;
  owner: { full_name: string | null; email: string | null } | null;
}

interface ProjectRequestRow {
  id: string;
  title: string;
  state: "draft" | "submitted";
  updated_at: string;
  status: { id: string; label: string; color: string } | null;
  product: { id: string; name: string } | null;
  team: { id: string; name: string } | null;
  author: { full_name: string | null; email: string | null } | null;
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select(
      "id, name, description, owner_id, updated_at, " +
        "owner:profiles!projects_owner_id_fkey(full_name, email)"
    )
    .eq("id", id)
    .maybeSingle<ProjectRow>();

  if (!project) notFound();

  const canManage =
    profile.role === "admin" || project.owner_id === profile.id;

  const { data: requestData } = await supabase
    .from("requests")
    .select(
      "id, title, state, updated_at, " +
        "status:statuses(id, label, color), " +
        "product:products(id, name), " +
        "team:teams!requests_team_id_fkey(id, name), " +
        "author:profiles!requests_author_id_fkey(full_name, email)"
    )
    .eq("project_id", id)
    .order("updated_at", { ascending: false })
    .returns<ProjectRequestRow[]>();

  const requests = requestData ?? [];

  // Group by owning team so the cross-team spread of a project is visible.
  const groups = new Map<string, { name: string; rows: ProjectRequestRow[] }>();
  for (const r of requests) {
    const key = r.team?.id ?? "__none__";
    const name = r.team?.name ?? "Unassigned";
    if (!groups.has(key)) groups.set(key, { name, rows: [] });
    groups.get(key)!.rows.push(r);
  }
  const grouped = Array.from(groups.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  // Candidates to attach: the caller's own requests not already in this project.
  let candidates: { id: string; title: string; productName: string | null }[] =
    [];
  if (canManage) {
    const { data: mine } = await supabase
      .from("requests")
      .select("id, title, project_id, product:products(id, name)")
      .eq("author_id", profile.id)
      .order("updated_at", { ascending: false })
      .returns<
        {
          id: string;
          title: string;
          project_id: string | null;
          product: { id: string; name: string } | null;
        }[]
      >();
    candidates = (mine ?? [])
      .filter((r) => r.project_id !== id)
      .map((r) => ({
        id: r.id,
        title: r.title,
        productName: r.product?.name ?? null,
      }));
  }

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
            <h1 className="text-2xl font-semibold tracking-tight">
              {project.name}
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              {project.description || "No description."}
            </p>
            <p className="text-xs text-muted-foreground">
              {project.owner?.email ?? project.owner?.full_name ?? "Unknown"} ·
              updated <LocalTime value={project.updated_at} /> ·{" "}
              {requests.length} request{requests.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild size="sm">
              <Link href={`/requests/new?project=${project.id}`}>
                <Plus className="mr-1.5 h-4 w-4" />
                New request
              </Link>
            </Button>
            {canManage && (
              <>
                <ProjectDialog
                  project={{
                    id: project.id,
                    name: project.name,
                    description: project.description,
                  }}
                />
                <DeleteProjectButton
                  projectId={project.id}
                  projectName={project.name}
                />
              </>
            )}
          </div>
        </div>
      </header>

      {canManage && (
        <section className="space-y-2 rounded-lg border border-dashed p-4">
          <h2 className="text-sm font-medium">Add a request to this project</h2>
          <AttachRequestControl projectId={project.id} candidates={candidates} />
        </section>
      )}

      {requests.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            No requests in this project yet. Use{" "}
            <span className="font-medium text-foreground">New request</span> to
            create one here, or add an existing one above.
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
                  {g.rows.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center gap-3 p-3 sm:px-4"
                    >
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/requests/${r.id}`}
                          className="font-medium hover:underline"
                        >
                          {r.title || "Untitled draft"}
                        </Link>
                        {r.state === "draft" && (
                          <Badge variant="secondary" className="ml-2">
                            Draft
                          </Badge>
                        )}
                        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Layers className="h-3 w-3" />
                          {r.product?.name ?? "No workstream"}
                          <span>·</span>
                          <span>
                            {r.author?.email ??
                              r.author?.full_name ??
                              "Unknown"}
                          </span>
                          <span>·</span>
                          <LocalTime value={r.updated_at} />
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
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                      {canManage && <DetachRequestButton requestId={r.id} />}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
