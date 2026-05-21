import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Product } from "@/lib/types";
import { ProductDialog } from "./_components/product-dialog";
import { DeleteProductButton } from "./_components/delete-product-button";

export default async function AdminProductsPage() {
  const supabase = await createClient();
  const { data: products } = await supabase
    .from("products")
    .select("*")
    .order("name")
    .returns<Product[]>();

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
          <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
          <p className="text-sm text-muted-foreground">
            The catalog the request form lets authors pick from.
          </p>
        </div>
        <ProductDialog
          mode="create"
          trigger={<Button>Add product</Button>}
        />
      </header>

      <Card>
        <CardContent className="p-0">
          {!products || products.length === 0 ? (
            <div className="flex flex-col items-center gap-3 p-8 text-center sm:p-12">
              <p className="text-base font-medium">No products yet</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Add the products your org takes requests for. Requesters will
                pick one when filling in the form.
              </p>
              <div className="mt-2">
                <ProductDialog
                  mode="create"
                  trigger={<Button>Add product</Button>}
                />
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-24 text-right">Requests</TableHead>
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
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {usageByProduct.get(p.id) ?? 0}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <ProductDialog
                          mode="edit"
                          product={p}
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
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
