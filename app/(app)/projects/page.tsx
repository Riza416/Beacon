import Link from "next/link";
import { FolderKanban, Layers } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LocalTime } from "@/components/local-time";
import { ProjectDialog } from "./_components/project-dialog";

export const dynamic = "force-dynamic";

interface ProjectListRow {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  updated_at: string;
  owner: { full_name: string | null; email: string | null } | null;
  requests: { count: number }[];
}

export default async function ProjectsPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  // Projects are readable by everyone; show the caller's own first, then the
  // rest. The embedded count uses the requests_project_id FK.
  const { data } = await supabase
    .from("projects")
    .select(
      "id, name, description, owner_id, updated_at, " +
        "owner:profiles!projects_owner_id_fkey(full_name, email), " +
        "requests:requests!requests_project_id_fkey(count)"
    )
    .order("updated_at", { ascending: false })
    .returns<ProjectListRow[]>();

  const projects = data ?? [];
  const mine = projects.filter((p) => p.owner_id === profile.id);
  const others = projects.filter((p) => p.owner_id !== profile.id);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground">
            Group requests to different teams under one project and track them
            together.
          </p>
        </div>
        <ProjectDialog />
      </header>

      <ProjectGrid
        title="Your projects"
        projects={mine}
        emptyMessage="You haven't created any projects yet. Create one, then file requests under it."
      />

      {others.length > 0 && (
        <ProjectGrid title="Other people's projects" projects={others} />
      )}
    </div>
  );
}

function ProjectGrid({
  title,
  projects,
  emptyMessage,
}: {
  title: string;
  projects: ProjectListRow[];
  emptyMessage?: string;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {projects.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            {emptyMessage ?? "Nothing here yet."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => {
            const count = p.requests?.[0]?.count ?? 0;
            return (
              <Link key={p.id} href={`/projects/${p.id}`} className="group">
                <Card className="h-full transition-colors group-hover:border-primary/40">
                  <CardContent className="flex h-full flex-col gap-3 p-5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <FolderKanban className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <h3 className="truncate font-semibold">{p.name}</h3>
                      </div>
                      <Badge
                        variant="secondary"
                        className="shrink-0 gap-1 tabular-nums"
                      >
                        <Layers className="h-3 w-3" />
                        {count}
                      </Badge>
                    </div>
                    <p className="line-clamp-2 flex-1 text-sm text-muted-foreground">
                      {p.description || "No description."}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {p.owner?.email ?? p.owner?.full_name ?? "Unknown"} ·
                      updated <LocalTime value={p.updated_at} />
                    </p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
