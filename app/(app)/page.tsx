import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

type RequestWithJoins = {
  id: string;
  title: string;
  summary: string | null;
  state: "draft" | "submitted";
  priority: number;
  submitted_at: string | null;
  updated_at: string;
  notion_url: string | null;
  author_id: string;
  status: { id: string; label: string; color: string } | null;
  author: { full_name: string | null; email: string | null } | null;
};

export default async function DashboardPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const isAdmin = profile.role === "admin";

  const { data: statuses } = await supabase
    .from("statuses")
    .select("id, label, color, display_order")
    .order("display_order");

  const baseQuery = supabase
    .from("requests")
    .select(
      "id, title, summary, state, priority, submitted_at, updated_at, notion_url, author_id, status:statuses(id, label, color), author:profiles!requests_author_id_fkey(full_name, email)"
    );

  const { data: mine } = await baseQuery
    .eq("author_id", profile.id)
    .order("priority", { ascending: true })
    .order("updated_at", { ascending: false })
    .returns<RequestWithJoins[]>();

  const { data: all } = isAdmin
    ? await baseQuery
        .order("updated_at", { ascending: false })
        .limit(50)
        .returns<RequestWithJoins[]>()
    : { data: null as RequestWithJoins[] | null };

  const { data: awaitingTriage } = isAdmin
    ? await supabase
        .from("requests")
        .select(
          "id, title, state, priority, submitted_at, updated_at, notion_url, author_id, summary, status:statuses(id, label, color), author:profiles!requests_author_id_fkey(full_name, email)"
        )
        .eq("state", "submitted")
        .is("status_id", null)
        .order("submitted_at", { ascending: false })
        .limit(20)
        .returns<RequestWithJoins[]>()
    : { data: null as RequestWithJoins[] | null };

  const counts = new Map<string, number>();
  if (isAdmin && all) {
    for (const r of all) {
      const key = r.status?.label ?? "Unassigned";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {isAdmin ? "All requests" : "Your requests"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin
              ? "Everything in motion across the org."
              : "Drafts, in-flight, and submitted requests."}
          </p>
        </div>
        <Button asChild>
          <Link href="/requests/new">New request</Link>
        </Button>
      </header>

      {isAdmin && (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {statuses?.map((s) => (
            <Card key={s.id}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="text-sm font-medium">{s.label}</span>
                </div>
                <p className="mt-2 text-2xl font-semibold">
                  {counts.get(s.label) ?? 0}
                </p>
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      {isAdmin && awaitingTriage && awaitingTriage.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Awaiting triage</h2>
          <RequestList items={awaitingTriage} />
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-medium">
          {isAdmin ? "Recently updated" : "Yours"}
        </h2>
        <RequestList items={(isAdmin ? all : mine) ?? []} />
      </section>
    </div>
  );
}

function RequestList({ items }: { items: RequestWithJoins[] }) {
  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          Nothing here yet.{" "}
          <Link className="underline" href="/requests/new">
            Create a request
          </Link>
          .
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="grid gap-3">
      {items.map((r) => (
        <Card key={r.id}>
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div className="space-y-1">
              <CardTitle>
                <Link href={`/requests/${r.id}`} className="hover:underline">
                  {r.title || "Untitled draft"}
                </Link>
              </CardTitle>
              <CardDescription className="line-clamp-2">
                {r.summary || "No summary yet."}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {r.state === "draft" && <Badge variant="secondary">Draft</Badge>}
              {r.status && (
                <Badge
                  style={{ backgroundColor: r.status.color, color: "white" }}
                >
                  {r.status.label}
                </Badge>
              )}
              {r.notion_url && (
                <a
                  href={r.notion_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs underline text-muted-foreground"
                >
                  Notion ↗
                </a>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">
            {r.author?.email ?? r.author?.full_name ?? "—"} ·{" "}
            {formatDate(r.updated_at)}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
