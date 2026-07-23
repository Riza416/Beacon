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
import { LocalTime } from "@/components/local-time";

export const dynamic = "force-dynamic";

type RequestSummary = {
  id: string;
  title: string;
  state: "draft" | "submitted";
  updated_at: string;
  submitted_at: string | null;
  status: { id: string; label: string; color: string } | null;
  author: { full_name: string | null; email: string | null } | null;
};

interface TaggedRow {
  request: RequestSummary;
  /** "user" tag uses the row directly; "team" tag has a per-user view. */
  kind: "user" | "team";
  /** Most-recent of (tag created_at, view created/needed). Used to sort. */
  sortKey: string;
  unread: boolean;
}

export default async function TaggedForMePage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  // 1) User tags on me.
  const { data: userTags } = await supabase
    .from("request_collaborators")
    .select("request_id, created_at, viewed_at")
    .eq("user_id", profile.id)
    .returns<
      { request_id: string; created_at: string; viewed_at: string | null }[]
    >();

  // 2) Team tags on my team (if any).
  let teamTags:
    | { request_id: string; team_id: string; created_at: string }[]
    | null = null;
  let teamViews: { request_id: string; team_id: string }[] = [];
  if (profile.team_id) {
    const { data: tt } = await supabase
      .from("request_team_tags")
      .select("request_id, team_id, created_at")
      .eq("team_id", profile.team_id)
      .returns<
        { request_id: string; team_id: string; created_at: string }[]
      >();
    teamTags = tt ?? [];

    const { data: tv } = await supabase
      .from("request_team_tag_views")
      .select("request_id, team_id")
      .eq("user_id", profile.id)
      .eq("team_id", profile.team_id)
      .returns<{ request_id: string; team_id: string }[]>();
    teamViews = tv ?? [];
  }

  const seenTeamView = new Set(
    teamViews.map((v) => `${v.request_id}::${v.team_id}`)
  );

  // Collect distinct request ids: a single request may be tagged via both a
  // direct user tag and a team tag; the user only sees one row per request.
  const byRequest = new Map<
    string,
    { kind: "user" | "team"; unread: boolean; sortKey: string }
  >();

  for (const t of userTags ?? []) {
    byRequest.set(t.request_id, {
      kind: "user",
      unread: t.viewed_at === null,
      sortKey: t.created_at,
    });
  }
  for (const t of teamTags ?? []) {
    const existing = byRequest.get(t.request_id);
    const unread = !seenTeamView.has(`${t.request_id}::${t.team_id}`);
    if (!existing) {
      byRequest.set(t.request_id, { kind: "team", unread, sortKey: t.created_at });
    } else {
      // Merge: unread if either source is unread, keep newest sortKey.
      const combinedSort =
        t.created_at > existing.sortKey ? t.created_at : existing.sortKey;
      byRequest.set(t.request_id, {
        kind: existing.kind,
        unread: existing.unread || unread,
        sortKey: combinedSort,
      });
    }
  }

  const requestIds = Array.from(byRequest.keys());

  let requests: RequestSummary[] = [];
  if (requestIds.length > 0) {
    const { data } = await supabase
      .from("requests")
      .select(
        "id, title, state, updated_at, submitted_at, " +
          "status:statuses(id, label, color), " +
          "author:profiles!requests_author_id_fkey(full_name, email)"
      )
      .in("id", requestIds)
      .returns<RequestSummary[]>();
    requests = data ?? [];
  }

  const rows: TaggedRow[] = requests
    .map((r) => {
      const meta = byRequest.get(r.id);
      // meta is guaranteed because requestIds is derived from byRequest, but
      // keep the guard for the type checker.
      if (!meta) return null;
      return {
        request: r,
        kind: meta.kind,
        unread: meta.unread,
        sortKey: meta.sortKey,
      } satisfies TaggedRow;
    })
    .filter((x): x is TaggedRow => x !== null)
    .sort((a, b) => (a.sortKey < b.sortKey ? 1 : a.sortKey > b.sortKey ? -1 : 0));

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Tagged for me</h1>
        <p className="text-sm text-muted-foreground">
          Requests where you (or your team) were asked to weigh in.
        </p>
      </header>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Nothing tagged for you yet.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent</CardTitle>
            <CardDescription>Most-recently tagged first.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y">
              {rows.map(({ request: r, kind, unread }) => {
                const authorLabel =
                  r.author?.full_name ?? r.author?.email ?? "Unknown author";
                return (
                  <li key={r.id} className="p-4">
                    <Link
                      href={`/requests/${r.id}`}
                      className="flex flex-wrap items-center gap-3 hover:underline"
                    >
                      {unread ? (
                        <span
                          aria-label="Unread"
                          className="inline-block h-2 w-2 shrink-0 rounded-full bg-violet-600"
                        />
                      ) : (
                        <span className="inline-block h-2 w-2 shrink-0" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="font-medium">
                          {r.title || "Untitled draft"}
                        </span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          via {kind === "user" ? "you" : "your team"} · By {authorLabel} ·{" "}
                          <LocalTime value={r.submitted_at ?? r.updated_at} />
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
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
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
