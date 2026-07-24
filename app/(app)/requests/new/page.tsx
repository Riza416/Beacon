import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RequestForm } from "@/components/request-form";

export const dynamic = "force-dynamic";

export default async function NewRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  // No draft row is created here — the form persists one lazily the first time
  // the author explicitly saves or submits (see createDraft/ensureId). This
  // means abandoned "new request" visits never leave a draft behind.
  const profile = await requireProfile();
  const { project: projectParam } = await searchParams;
  const supabase = await createClient();

  const { data: productRows } = await supabase
    .from("products")
    .select(
      "id, name, show_deadline, show_dependent_teams, " +
        "owner:profiles!products_owner_id_fkey(full_name, email)"
    )
    .order("name")
    .returns<
      {
        id: string;
        name: string;
        show_deadline: boolean;
        show_dependent_teams: boolean;
        owner: { full_name: string | null; email: string | null } | null;
      }[]
    >();
  const products = (productRows ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    show_deadline: p.show_deadline,
    show_dependent_teams: p.show_dependent_teams,
    owner_name: p.owner?.full_name || p.owner?.email || null,
  }));

  const { data: allTeams } = await supabase
    .from("teams")
    .select("id, name")
    .order("name", { ascending: true })
    .returns<{ id: string; name: string }[]>();

  // The caller's own projects, for the optional Project picker.
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name")
    .eq("owner_id", profile.id)
    .order("updated_at", { ascending: false })
    .returns<{ id: string; name: string }[]>();

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">New request</h1>
          <p className="text-sm text-muted-foreground">
            Fill in the details below. Nothing is saved until you save the
            draft or submit.
          </p>
        </div>
        <Button asChild variant="ghost">
          <Link href="/requests/mine">Back to my requests</Link>
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Request details</CardTitle>
          <CardDescription>
            Required fields are marked with a red asterisk. Soft-required
            fields have a small dot — you can skip them but the team may ask
            for more info.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RequestForm
            request={null}
            fields={[]}
            values={[]}
            canSubmit={true}
            hasTeam={Boolean(profile.team_id)}
            uploaderId={profile.id}
            signedUrls={{}}
            products={products}
            allTeams={allTeams ?? []}
            initialTaggedTeamIds={[]}
            authorTeamId={profile.team_id}
            projects={projects ?? []}
            initialProjectId={projectParam ?? null}
          />
        </CardContent>
      </Card>
    </div>
  );
}
