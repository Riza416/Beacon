import Link from "next/link";
import { requireTeamManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Product, Team } from "@/lib/types";
import { TeamProductDialog } from "./_components/team-product-dialog";
import { DeleteTeamProductButton } from "./_components/delete-team-product-button";

export default async function TeamProductsPage() {
  const profile = await requireTeamManager();
  const teamId = profile.team_id;

  // Global admins have no single team scope — send them to the admin catalog.
  if (!teamId) {
    return (
      <div className="space-y-8">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
        </header>
        <Card>
          <CardHeader>
            <CardTitle>You&rsquo;re a global admin</CardTitle>
            <CardDescription>
              Manage all products under Admin → Products.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/admin/products">Go to Admin → Products</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const supabase = await createClient();

  const { data: team } = await supabase
    .from("teams")
    .select("name, can_manage_products")
    .eq("id", teamId)
    .maybeSingle<Pick<Team, "name" | "can_manage_products">>();

  const headerContent = (
    <div className="space-y-1">
      <Link
        href="/team"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back to team
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
      {team?.name ? (
        <p className="text-sm text-muted-foreground">{team.name}</p>
      ) : null}
    </div>
  );

  // The grant is required before a team may touch the catalog at all.
  if (!team?.can_manage_products) {
    return (
      <div className="space-y-8">
        <header>{headerContent}</header>
        <Card>
          <CardHeader>
            <CardTitle>Product management not enabled</CardTitle>
            <CardDescription>
              Your team hasn&rsquo;t been granted product management yet. Ask a
              global admin to enable it.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Products this team owns: resolve owned ids, then fetch the products.
  const { data: ownerRows } = await supabase
    .from("product_owners")
    .select("product_id")
    .eq("team_id", teamId)
    .returns<{ product_id: string }[]>();
  const ownedIds = (ownerRows ?? []).map((r) => r.product_id);

  let products: Product[] = [];
  if (ownedIds.length > 0) {
    const { data } = await supabase
      .from("products")
      .select("*")
      .in("id", ownedIds)
      .order("name")
      .returns<Product[]>();
    products = data ?? [];
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        {headerContent}
        <TeamProductDialog
          mode="create"
          trigger={<Button>Add product</Button>}
        />
      </header>

      <Card>
        <CardContent className="p-0">
          {products.length === 0 ? (
            <div className="flex flex-col items-center gap-3 p-8 text-center sm:p-12">
              <p className="text-base font-medium">No products yet</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Add the products your team takes requests for. Use the
                &ldquo;Add product&rdquo; button above to start.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-40 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {p.description ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <TeamProductDialog
                          mode="edit"
                          product={p}
                          trigger={
                            <Button variant="outline" size="sm">
                              Edit
                            </Button>
                          }
                        />
                        <DeleteTeamProductButton
                          productId={p.id}
                          productName={p.name}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
