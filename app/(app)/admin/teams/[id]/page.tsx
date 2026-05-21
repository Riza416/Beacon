import Link from "next/link";
import { notFound } from "next/navigation";
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
import type { Profile, Team } from "@/lib/types";
import { EditTeamDialog } from "../_components/edit-team-dialog";
import { AddMemberDialog } from "../_components/add-member-dialog";
import { RemoveMemberButton } from "../_components/remove-member-button";
import { DeleteTeamButton } from "../_components/delete-team-button";

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: team } = await supabase
    .from("teams")
    .select("*")
    .eq("id", id)
    .maybeSingle<Team>();

  if (!team) notFound();

  const { data: members } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, team_id, created_at, updated_at")
    .eq("team_id", id)
    .order("full_name", { ascending: true })
    .returns<Profile[]>();

  const { data: candidates } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .or(`team_id.is.null,team_id.neq.${id}`)
    .order("full_name", { ascending: true })
    .returns<{ id: string; full_name: string | null; email: string | null }[]>();

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            <Link href="/admin/teams" className="hover:underline">
              Teams
            </Link>{" "}
            /
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{team.name}</h1>
          <p className="text-sm text-muted-foreground">
            {team.description || "No description."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <EditTeamDialog team={team} />
          <DeleteTeamButton teamId={team.id} teamName={team.name} />
        </div>
      </header>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-medium">
            Members ({members?.length ?? 0})
          </h2>
          <AddMemberDialog teamId={team.id} candidates={candidates ?? []} />
        </div>

        <Card>
          <CardContent className="p-0">
            {!members || members.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No members in this team yet.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="w-32 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">
                        {m.full_name || "Unnamed"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {m.email}
                      </TableCell>
                      <TableCell className="text-right">
                        <RemoveMemberButton
                          teamId={team.id}
                          profileId={m.id}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
