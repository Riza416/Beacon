import { Building2, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import type { Company, Team } from "@/lib/types";
import { TEAM_WITH_MEMBER_COUNT_SELECT } from "@/lib/queries";
import { CreateTeamDialog } from "./_components/create-team-dialog";
import { CompaniesManager } from "./_components/companies-manager";
import { TeamsList } from "./_components/teams-list";

type TeamWithMembers = Team & {
  members: { count: number }[] | null;
};

export default async function AdminTeamsPage() {
  const supabase = await createClient();
  const [{ data: teams }, { data: companies }] = await Promise.all([
    supabase
      .from("teams")
      // Explicit FK path required: request_team_tag_views introduced a second
      // teams⇄profiles relationship that PostgREST can't pick between.
      .select(TEAM_WITH_MEMBER_COUNT_SELECT)
      .order("name", { ascending: true })
      .returns<TeamWithMembers[]>(),
    supabase
      .from("companies")
      .select("id, name")
      .order("name", { ascending: true })
      .returns<Pick<Company, "id" | "name">[]>(),
  ]);
  const companyNameById = new Map(
    (companies ?? []).map((c) => [c.id, c.name])
  );

  // Flatten to plain, serializable rows for the client-side list/filter. All
  // data fetching stays here in the server component.
  const teamItems = (teams ?? []).map((team) => ({
    id: team.id,
    name: team.name,
    companyName: team.company_id
      ? companyNameById.get(team.company_id) ?? null
      : null,
    description: team.description,
    memberCount: team.members?.[0]?.count ?? 0,
  }));

  const teamCount = teamItems.length;
  const companyCount = companies?.length ?? 0;

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Teams</h1>
          <p className="text-[15px] text-muted-foreground">
            Group people for tagging, routing, and visibility.
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 pt-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              {teamCount} {teamCount === 1 ? "team" : "teams"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Building2 className="h-4 w-4" />
              {companyCount} {companyCount === 1 ? "company" : "companies"}
            </span>
          </div>
        </div>
        <CreateTeamDialog companies={companies ?? []} />
      </header>

      <section className="space-y-5">
        {teamCount === 0 ? (
          <Card className="rounded-2xl border-border/60">
            <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
              <p className="text-base font-medium">No teams yet</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Create a team to group people for tagging, routing, and
                visibility.
              </p>
              <div className="mt-2">
                <CreateTeamDialog companies={companies ?? []} />
              </div>
            </CardContent>
          </Card>
        ) : (
          <TeamsList teams={teamItems} />
        )}
      </section>

      <section className="border-t border-border/60 pt-8">
        <CompaniesManager companies={companies ?? []} />
      </section>
    </div>
  );
}
