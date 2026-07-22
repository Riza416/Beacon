import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Company, Team } from "@/lib/types";
import { TEAM_WITH_MEMBER_COUNT_SELECT } from "@/lib/queries";
import { CreateTeamDialog } from "./_components/create-team-dialog";
import { CompaniesManager } from "./_components/companies-manager";

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

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Teams</h1>
          <p className="text-sm text-muted-foreground">
            Group people for tagging, routing, and visibility.
          </p>
        </div>
        <CreateTeamDialog companies={companies ?? []} />
      </header>

      <CompaniesManager companies={companies ?? []} />

      <Card>
        <CardContent className="p-0">
          {!teams || teams.length === 0 ? (
            <div className="flex flex-col items-center gap-3 p-8 text-center sm:p-12">
              <p className="text-base font-medium">No teams yet</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Create a team to group people for tagging, routing, and
                visibility.
              </p>
              <div className="mt-2">
                <CreateTeamDialog companies={companies ?? []} />
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-24">Members</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teams.map((team) => {
                  const memberCount = team.members?.[0]?.count ?? 0;
                  return (
                    <TableRow key={team.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/admin/teams/${team.id}`}
                          className="hover:underline"
                        >
                          {team.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {team.company_id
                          ? companyNameById.get(team.company_id) ?? "—"
                          : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {team.description || "—"}
                      </TableCell>
                      <TableCell>{memberCount}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
