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
import type { Team } from "@/lib/types";
import { CreateTeamDialog } from "./_components/create-team-dialog";

type TeamWithMembers = Team & {
  members: { count: number }[] | null;
};

export default async function AdminTeamsPage() {
  const supabase = await createClient();
  const { data: teams } = await supabase
    .from("teams")
    .select("*, members:profiles(count)")
    .order("name", { ascending: true })
    .returns<TeamWithMembers[]>();

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Teams</h1>
          <p className="text-sm text-muted-foreground">
            Group people for tagging, routing, and visibility.
          </p>
        </div>
        <CreateTeamDialog />
      </header>

      <Card>
        <CardContent className="p-0">
          {!teams || teams.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No teams yet. Create one to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
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
