import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Status } from "@/lib/types";
import { StatusDialog } from "./_components/status-dialog";
import { StatusRowActions } from "./_components/status-row-actions";

export default async function AdminStatusesPage() {
  const supabase = await createClient();
  const { data: statuses } = await supabase
    .from("statuses")
    .select("*")
    .order("display_order", { ascending: true })
    .returns<Status[]>();

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Statuses</h1>
          <p className="text-sm text-muted-foreground">
            The lifecycle a request can move through. Reorder, edit colors, or
            mark one as default.
          </p>
        </div>
        <StatusDialog mode="create" trigger={<Button>Add status</Button>} />
      </header>

      <Card>
        <CardContent className="p-0">
          {!statuses || statuses.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No statuses yet. Add one to start triaging requests.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>Color</TableHead>
                  <TableHead>Flags</TableHead>
                  <TableHead className="w-64 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {statuses.map((status, idx) => (
                  <TableRow key={status.id}>
                    <TableCell className="text-muted-foreground">
                      {idx + 1}
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: status.color }}
                        />
                        {status.label}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {status.color}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {status.is_default && (
                          <Badge variant="default">Default</Badge>
                        )}
                        {status.is_terminal && (
                          <Badge variant="secondary">Terminal</Badge>
                        )}
                        {!status.is_default && !status.is_terminal && (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <StatusDialog
                          mode="edit"
                          status={status}
                          trigger={
                            <Button variant="outline" size="sm">
                              Edit
                            </Button>
                          }
                        />
                        <StatusRowActions
                          statusId={status.id}
                          statusLabel={status.label}
                          isFirst={idx === 0}
                          isLast={idx === statuses.length - 1}
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
