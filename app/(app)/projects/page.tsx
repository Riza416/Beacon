import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isDemoOn } from "@/lib/demo";
import { ProjectsBrowser, type ProjectCard } from "@/components/projects-browser";
import { DemoProjects } from "@/components/demo/demo-projects";
import { ProjectDialog } from "./_components/project-dialog";

export const dynamic = "force-dynamic";

interface ProjectListRow {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  is_private: boolean;
  updated_at: string;
  owner: { full_name: string | null; email: string | null } | null;
  requests: { count: number }[];
}

export default async function ProjectsPage() {
  const profile = await requireProfile();

  if (await isDemoOn(profile.role)) return <DemoProjects />;

  const supabase = await createClient();

  // RLS filters out private projects the caller can't see.
  const { data } = await supabase
    .from("projects")
    .select(
      "id, name, description, owner_id, is_private, updated_at, " +
        "owner:profiles!projects_owner_id_fkey(full_name, email), " +
        "requests:requests!requests_project_id_fkey(count)"
    )
    .order("updated_at", { ascending: false })
    .returns<ProjectListRow[]>();

  const projects: ProjectCard[] = (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    ownerId: p.owner_id,
    ownerLabel: p.owner?.email ?? p.owner?.full_name ?? "Unknown",
    isPrivate: p.is_private,
    updatedAt: p.updated_at,
    count: p.requests?.[0]?.count ?? 0,
  }));

  return (
    <div className="space-y-6">
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

      <ProjectsBrowser projects={projects} currentUserId={profile.id} />
    </div>
  );
}
