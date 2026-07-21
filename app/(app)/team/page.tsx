import Link from "next/link";
import { requireTeamManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { searchAddableUsers } from "@/app/(app)/team/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { InviteMemberDialog } from "./_components/invite-member-dialog";
import { AddExistingMemberDialog } from "./_components/add-existing-member-dialog";
import { RemoveMemberButton } from "./_components/remove-member-button";
import { MemberProductPermissionToggle } from "./_components/member-product-permission-toggle";

export default async function TeamPage() {
  const profile = await requireTeamManager();

  // A global admin without a team has nothing to manage here.
  if (profile.team_id === null) {
    return (
      <div className="space-y-8">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">My team</h1>
        </header>
        <Card>
          <CardHeader>
            <CardTitle>You&apos;re a global admin</CardTitle>
            <CardDescription>
              You&apos;re not assigned to a team. Manage teams from the admin
              area.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/admin/teams">Manage teams under Admin → Teams</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const teamId = profile.team_id;
  const supabase = await createClient();

  const { data: team } = await supabase
    .from("teams")
    .select("*")
    .eq("id", teamId)
    .maybeSingle<Team>();

  const { data: members } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, can_manage_products")
    .eq("team_id", teamId)
    .order("full_name", { ascending: true })
    .returns<
      Pick<
        Profile,
        "id" | "full_name" | "email" | "role" | "can_manage_products"
      >[]
    >();

  const candidates = await searchAddableUsers(teamId);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            My team
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {team?.name ?? "Team"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {team?.description || "Manage the people on your team."}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/team/products">Manage products</Link>
        </Button>
      </header>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-medium">
            Members ({members?.length ?? 0})
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <AddExistingMemberDialog teamId={teamId} candidates={candidates} />
            <InviteMemberDialog teamId={teamId} />
          </div>
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
                    <TableHead>Role</TableHead>
                    <TableHead>Products</TableHead>
                    <TableHead className="w-32 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((m) => {
                    const managesProducts =
                      m.role === "admin" || m.role === "team_admin";
                    return (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">
                          {m.full_name || "Unnamed"}
                          {m.id === profile.id && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              (you)
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {m.email}
                        </TableCell>
                        <TableCell>
                          {m.role === "team_admin" ? (
                            <Badge>Team admin</Badge>
                          ) : m.role === "admin" ? (
                            <Badge variant="secondary">Admin</Badge>
                          ) : (
                            <Badge variant="outline">Member</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {managesProducts ? (
                            <span className="text-xs text-muted-foreground">
                              Always
                            </span>
                          ) : (
                            <MemberProductPermissionToggle
                              profileId={m.id}
                              canManageProducts={m.can_manage_products}
                            />
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {m.id !== profile.id && (
                            <RemoveMemberButton
                              teamId={teamId}
                              profileId={m.id}
                            />
                          )}
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
    </div>
  );
}
