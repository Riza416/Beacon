import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ReorderButtons } from "@/components/reorder-buttons";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

type MineRow = {
  id: string;
  title: string;
  summary: string | null;
  state: "draft" | "submitted";
  priority: number;
  submitted_at: string | null;
  updated_at: string;
  notion_url: string | null;
  status: { id: string; label: string; color: string } | null;
};

export default async function MineRequestsPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data } = await supabase
    .from("requests")
    .select(
      "id, title, summary, state, priority, submitted_at, updated_at, notion_url, status:statuses(id, label, color)"
    )
    .eq("author_id", profile.id)
    .order("priority", { ascending: true })
    .order("updated_at", { ascending: false })
    .returns<MineRow[]>();

  const rows = data ?? [];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Your requests
          </h1>
          <p className="text-sm text-muted-foreground">
            Reorder by priority. Drafts can be edited; submitted requests are
            read-only.
          </p>
        </div>
        <Button asChild>
          <Link href="/requests/new">New request</Link>
        </Button>
      </header>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            You haven&apos;t created any requests yet.{" "}
            <Link className="underline" href="/requests/new">
              Start one
            </Link>
            .
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {rows.map((r, idx) => (
            <Card key={r.id}>
              <CardHeader className="flex flex-row items-start gap-3 space-y-0">
                <ReorderButtons
                  requestId={r.id}
                  canMoveUp={idx > 0}
                  canMoveDown={idx < rows.length - 1}
                />
                <div className="flex-1 space-y-1">
                  <CardTitle className="text-base">
                    <Link
                      href={
                        r.state === "draft"
                          ? `/requests/${r.id}/edit`
                          : `/requests/${r.id}`
                      }
                      className="hover:underline"
                    >
                      {r.title || "Untitled draft"}
                    </Link>
                  </CardTitle>
                  <CardDescription className="line-clamp-2">
                    {r.summary || "No summary yet."}
                  </CardDescription>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="flex items-center gap-2">
                    {r.state === "draft" && (
                      <Badge variant="secondary">Draft</Badge>
                    )}
                    {r.status && (
                      <Badge
                        style={{
                          backgroundColor: r.status.color,
                          color: "white",
                        }}
                      >
                        {r.status.label}
                      </Badge>
                    )}
                  </div>
                  <Button asChild variant="ghost" size="sm">
                    <Link
                      href={
                        r.state === "draft"
                          ? `/requests/${r.id}/edit`
                          : `/requests/${r.id}`
                      }
                    >
                      {r.state === "draft" ? "Edit" : "View"}
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0 text-xs text-muted-foreground">
                Updated {formatDate(r.updated_at)}
                {r.submitted_at
                  ? ` · submitted ${formatDate(r.submitted_at)}`
                  : ""}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
