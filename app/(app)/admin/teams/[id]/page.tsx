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
import { TEAM_REQUEST_SELECT } from "@/lib/queries";
import { formatDate } from "@/lib/utils";
import { EditTeamDialog } from "../_components/edit-team-dialog";
import { AddMemberDialog } from "../_components/add-member-dialog";
import { RemoveMemberButton } from "../_components/remove-member-button";
import { DeleteTeamButton } from "../_components/delete-team-button";
import { MemberRoleControls } from "../_components/member-role-controls";
import { MemberProductPermissionToggle } from "@/app/(app)/team/_components/member-product-permission-toggle";
import { SlackWebhookCard } from "@/app/(app)/team/_components/slack-webhook-card";
import { teamSlackConfigured } from "@/app/(app)/team/actions";

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
    .select("*")
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
    .select(TEAM_REQUEST_SELECT)
    .eq("team_id", id)
    .order("team_priority", { ascending: true })
    .order("updated_at", { ascending: false })
    .returns<TeamRequestRow[]>();

  // Requests where this team is tagged as a dependency (authored by some
  // other team). Two-step: get the tag rows, then fetch the requests by id
  // and exclude rows authored by this team (those are already above).
  const { data: tagRows } = await supabase
    .from("request_team_tags")
    .select("request_id")
    .eq("team_id", id)
    .returns<{ request_id: string }[]>();
  const taggedIds = (tagRows ?? []).map((r) => r.request_id);

  let dependencyRequests: TeamRequestRow[] = [];
  if (taggedIds.length > 0) {
    const { data: depRows } = await supabase
      .from("requests")
      .select(TEAM_REQUEST_SELECT)
      .in("id", taggedIds)
      .neq("team_id", id)
      .order("updated_at", { ascending: false })
      .returns<TeamRequestRow[]>();
    dependencyRequests = depRows ?? [];
  }

  const slackConfigured = await teamSlackConfigured(id);

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
        <div className="flex flex-wrap items-center gap-3">
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
              <RequestTable rows={requests} showPriority />
            )}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">
          Tagged as a dependency ({dependencyRequests.length})
        </h2>
        <p className="text-xs text-muted-foreground">
          Requests authored by other teams that list this team as an
          interdependent dependency.
        </p>
        <Card className="border-dashed">
          <CardContent className="p-0">
            {dependencyRequests.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No dependency tags on this team yet.
              </div>
            ) : (
              <RequestTable rows={dependencyRequests} />
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
                    <TableHead>Workstreams</TableHead>
                    <TableHead className="text-right">Role</TableHead>
                    <TableHead className="w-32 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((m) => {
                    const fullAccess =
                      m.role === "admin" || m.role === "team_admin";
                    return (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">
                          {m.full_name || "Unnamed"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {m.email}
                        </TableCell>
                        <TableCell>
                          {fullAccess ? (
                            <span className="text-xs text-muted-foreground">
                              Full access
                            </span>
                          ) : (
                            <MemberProductPermissionToggle
                              profileId={m.id}
                              canCreate={m.can_create_products}
                              canEdit={m.can_edit_products}
                              canDelete={m.can_delete_products}
                            />
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <MemberRoleControls
                            teamId={team.id}
                            profileId={m.id}
                            role={m.role}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <RemoveMemberButton
                            teamId={team.id}
                            profileId={m.id}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Alerts</h2>
        <SlackWebhookCard teamId={team.id} initialConfigured={slackConfigured} />
      </section>
    </div>
  );
}

function RequestTable({
  rows,
  showPriority = false,
}: {
  rows: TeamRequestRow[];
  showPriority?: boolean;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {showPriority && <TableHead className="w-16">Priority</TableHead>}
          <TableHead>Title</TableHead>
          <TableHead>Workstream</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Author</TableHead>
          <TableHead className="w-40">Updated</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id}>
            {showPriority && (
              <TableCell className="tabular-nums text-muted-foreground">
                {r.team_priority}
              </TableCell>
            )}
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
  );
}
