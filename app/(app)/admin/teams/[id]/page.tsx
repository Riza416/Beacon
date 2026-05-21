import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Profile, Team } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { EditTeamDialog } from "../_components/edit-team-dialog";
import { AddMemberDialog } from "../_components/add-member-dialog";
import { RemoveMemberButton } from "../_components/remove-member-button";
import { DeleteTeamButton } from "../_components/delete-team-button";

interface TeamRequestRow {
  id: string;
  title: string;
  state: "draft" | "submitted";
  team_priority: number;
  notion_url: string | null;
  updated_at: string;
  status: { id: string; label: string; color: string } | null;
  product: { id: string; name: string } | null;
  author: { full_name: string | null; email: string | null } | null;
}

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

  // Requests authored by anyone on this team. Ordered by team_priority asc
  // (the team's dense sequence) so the team's priority order is immediately
  // visible here too.
  const { data: requests } = await supabase
    .from("requests")
    .select(
      "id, title, state, team_priority, notion_url, updated_at, " +
        "status:statuses(id, label, color), " +
        "product:products(id, name), " +
        "author:profiles!requests_author_id_fkey(full_name, email)"
    )
    .eq("team_id", id)
    .order("team_priority", { ascending: true })
    .order("updated_at", { ascending: false })
    .returns<TeamRequestRow[]>();

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
        <h2 className="text-lg font-medium">
          Requests ({requests?.length ?? 0})
        </h2>
        <Card>
          <CardContent className="p-0">
            {!requests || requests.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No requests from this team yet.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Priority</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Author</TableHead>
                    <TableHead className="w-40">Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {r.team_priority}
                      </TableCell>
                      <TableCell className="font-medium">
                        <Link
                          href={`/requests/${r.id}`}
                          className="hover:underline"
                        >
                          {r.title || "Untitled draft"}
                        </Link>
                        {r.state === "draft" && (
                          <Badge variant="secondary" className="ml-2">
                            Draft
                          </Badge>
                        )}
                        {r.notion_url && (
                          <a
                            href={r.notion_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-2 text-xs underline text-muted-foreground"
                          >
                            Notion ↗
                          </a>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.product?.name ?? "—"}
                      </TableCell>
                      <TableCell>
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
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.author?.email ?? r.author?.full_name ?? "Unknown"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(r.updated_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </section>

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
