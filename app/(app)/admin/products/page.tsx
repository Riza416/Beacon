import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Product, Team } from "@/lib/types";
import { ProductDialog } from "./_components/product-dialog";
import { DeleteProductButton } from "./_components/delete-product-button";
import { OwnerPicker } from "./_components/owner-picker";

export default async function AdminProductsPage() {
  const supabase = await createClient();
  const { data: products } = await supabase
    .from("products")
    .select("*")
    .order("name")
    .returns<Product[]>();

  // All teams for the owning-team picker.
  const { data: teams } = await supabase
    .from("teams")
    .select("id, name")
    .order("name")
    .returns<Pick<Team, "id" | "name">[]>();
  const teamNameById = new Map((teams ?? []).map((t) => [t.id, t.name]));

  // Ownership rows -> map of product_id -> owning team ids.
  const { data: ownerRows } = await supabase
    .from("product_owners")
    .select("product_id, team_id")
    .returns<{ product_id: string; team_id: string }[]>();
  const ownersByProduct = new Map<string, string[]>();
  for (const r of ownerRows ?? []) {
    const list = ownersByProduct.get(r.product_id) ?? [];
    list.push(r.team_id);
    ownersByProduct.set(r.product_id, list);
  }

  // Profiles grouped by team, so the owner picker can offer only members of a
  // product's owning team(s).
  const { data: profileRows } = await supabase
    .from("profiles")
    .select("id, full_name, email, team_id")
    .order("full_name", { ascending: true })
    .returns<
      { id: string; full_name: string | null; email: string | null; team_id: string | null }[]
    >();
  const membersByTeam = new Map<
    string,
    { id: string; full_name: string | null; email: string | null }[]
  >();
  for (const p of profileRows ?? []) {
    if (!p.team_id) continue;
    const list = membersByTeam.get(p.team_id) ?? [];
    list.push({ id: p.id, full_name: p.full_name, email: p.email });
    membersByTeam.set(p.team_id, list);
  }

  // Per-product usage counts so admins know what's in play before deleting.
  const { data: usageRows } = await supabase
    .from("requests")
    .select("product_id")
    .not("product_id", "is", null)
    .returns<{ product_id: string }[]>();
  const usageByProduct = new Map<string, number>();
  for (const r of usageRows ?? []) {
    usageByProduct.set(r.product_id, (usageByProduct.get(r.product_id) ?? 0) + 1);
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Workstreams</h1>
          <p className="text-sm text-muted-foreground">
            The catalog the request form lets authors pick from.
          </p>
        </div>
        <ProductDialog
          mode="create"
          teams={teams ?? []}
          trigger={<Button>Add workstream</Button>}
        />
      </header>

      <Card>
        <CardContent className="p-0">
          {!products || products.length === 0 ? (
            <div className="flex flex-col items-center gap-3 p-8 text-center sm:p-12">
              <p className="text-base font-medium">No workstreams yet</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Add the workstreams your org takes requests for. Use the
                &ldquo;Add workstream&rdquo; button above to start.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Owning teams</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-24 text-right">Requests</TableHead>
                  <TableHead className="w-40 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => {
                  const ownerIds = ownersByProduct.get(p.id) ?? [];
                  // Eligible owners = members of any owning team (deduped).
                  const eligible = new Map<
                    string,
                    { id: string; full_name: string | null; email: string | null }
                  >();
                  for (const tid of ownerIds) {
                    for (const m of membersByTeam.get(tid) ?? []) {
                      eligible.set(m.id, m);
                    }
                  }
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell>
                        {ownerIds.length === 0 ? (
                          <span className="text-xs text-muted-foreground">
                            Unassigned
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {ownerIds.map((tid) => (
                              <Badge key={tid} variant="secondary">
                                {teamNameById.get(tid) ?? "Unknown team"}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <OwnerPicker
                          productId={p.id}
                          currentOwnerId={p.owner_id}
                          members={[...eligible.values()]}
                          hasOwningTeams={ownerIds.length > 0}
                        />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {p.description ?? "—"}
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {usageByProduct.get(p.id) ?? 0}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/admin/products/${p.id}/template`}>
                              Template
                            </Link>
                          </Button>
                          <ProductDialog
                            mode="edit"
                            product={p}
                            teams={teams ?? []}
                            ownerTeamIds={ownerIds}
                            trigger={
                              <Button variant="outline" size="sm">
                                Edit
                              </Button>
                            }
                          />
                          <DeleteProductButton
                            productId={p.id}
                            productName={p.name}
                          />
                        </div>
                      </TableCell>
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
