import Link from "next/link";
import { LayoutList, Layers, MessageSquare } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MyRequestsSortable } from "@/components/my-requests-sortable";
import {
  MyRequestsByWorkstream,
  type MyWorkstreamRow,
} from "@/components/my-requests-by-workstream";
import { HideDoneToggle } from "@/components/hide-done-toggle";
import { LocalTime } from "@/components/local-time";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const VIEW_LIST = "list";
const VIEW_WORKSTREAMS = "workstreams";

interface MinePageProps {
  searchParams: Promise<{ view?: string; done?: string }>;
}

export default async function MineRequestsPage({ searchParams }: MinePageProps) {
  const profile = await requireProfile();
  const { view: viewParam, done } = await searchParams;
  const view = viewParam === VIEW_WORKSTREAMS ? VIEW_WORKSTREAMS : VIEW_LIST;
  const hideDone = done === "hide";

  const supabase = await createClient();

  const { data } = await supabase
    .from("requests")
    .select(
      "id, title, summary, state, priority, submitted_at, updated_at, notion_url, status:statuses(id, label, color, is_terminal), product:products(id, name)"
    )
    .eq("author_id", profile.id)
    .order("priority", { ascending: true })
    .order("updated_at", { ascending: false })
    .returns<MyWorkstreamRow[]>();

  const allRows = data ?? [];
  const doneCount = allRows.filter((r) => r.status?.is_terminal).length;
  const rows = hideDone
    ? allRows.filter((r) => !r.status?.is_terminal)
    : allRows;

  const unanswered = await fetchUnansweredComments(profile.id);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Your requests
          </h1>
          <p className="text-sm text-muted-foreground">
            {view === VIEW_WORKSTREAMS
              ? "Where your requests stand, grouped by workstream."
              : "Drag rows to reorder by priority. Drafts can be edited; submitted requests are read-only."}
          </p>
        </div>
        <Button asChild>
          <Link href="/requests/new">New request</Link>
        </Button>
      </header>

      {unanswered.length > 0 && (
        <section className="space-y-2 rounded-2xl border border-amber-500/40 bg-amber-500/5 p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <MessageSquare className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            Awaiting your reply ({unanswered.length})
          </h2>
          <ul className="space-y-2">
            {unanswered.map((c) => (
              <li
                key={c.comment_id}
                className="rounded-md border bg-background p-3 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>{c.author_label}</span>
                  <span>·</span>
                  <Link
                    href={`/requests/${c.request_id}`}
                    className="font-medium text-foreground hover:underline"
                  >
                    {c.request_title}
                  </Link>
                  <span>·</span>
                  <LocalTime value={c.created_at} />
                </div>
                <p className="mt-1 line-clamp-2">{c.body}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {allRows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center sm:p-12">
            <CardTitle className="text-base">
              You haven&apos;t created a request yet
            </CardTitle>
            <CardDescription className="max-w-sm">
              Capture an ask and the product team will pick it up from here.
            </CardDescription>
            <Button asChild className="mt-2">
              <Link href="/requests/new">New request</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b">
            <div className="flex items-center gap-1">
              <Tab
                href={hideDone ? "/requests/mine?done=hide" : "/requests/mine"}
                active={view === VIEW_LIST}
                icon={<LayoutList className="h-4 w-4" />}
                label="List"
              />
              <Tab
                href={
                  hideDone
                    ? "/requests/mine?view=workstreams&done=hide"
                    : "/requests/mine?view=workstreams"
                }
                active={view === VIEW_WORKSTREAMS}
                icon={<Layers className="h-4 w-4" />}
                label="By workstream"
              />
            </div>
            {doneCount > 0 && (
              <div className="pb-2">
                <HideDoneToggle hidden={hideDone} />
              </div>
            )}
          </div>

          {rows.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                All your requests are completed — untick &ldquo;Hide
                completed&rdquo; to see them.
              </CardContent>
            </Card>
          ) : view === VIEW_WORKSTREAMS ? (
            <MyRequestsByWorkstream rows={rows} />
          ) : (
            <MyRequestsSortable initialRows={rows} />
          )}
        </>
      )}
    </div>
  );
}

function Tab({
  href,
  active,
  icon,
  label,
}: {
  href: string;
  active: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
      )}
    >
      {icon}
      {label}
    </Link>
  );
}

interface UnansweredComment {
  comment_id: string;
  body: string;
  created_at: string;
  request_id: string;
  request_title: string;
  author_label: string;
}

/**
 * Comments on the author's own requests, by someone else, that are newer than
 * the author's most recent comment on that request (or where they never
 * replied) — i.e. comments still awaiting their reply.
 */
async function fetchUnansweredComments(
  profileId: string
): Promise<UnansweredComment[]> {
  const supabase = await createClient();

  const { data: myReqs } = await supabase
    .from("requests")
    .select("id, title")
    .eq("author_id", profileId)
    .returns<{ id: string; title: string }[]>();
  const ids = (myReqs ?? []).map((r) => r.id);
  if (ids.length === 0) return [];
  const titleById = new Map((myReqs ?? []).map((r) => [r.id, r.title]));

  const { data: comments } = await supabase
    .from("comments")
    .select(
      "id, body, created_at, request_id, author_id, author:profiles!comments_author_id_fkey(full_name, email)"
    )
    .in("request_id", ids)
    .order("created_at", { ascending: true })
    .returns<
      {
        id: string;
        body: string;
        created_at: string;
        request_id: string;
        author_id: string;
        author: { full_name: string | null; email: string | null } | null;
      }[]
    >();

  // The author's latest comment time per request (comments are ascending, so
  // the last one seen per request wins).
  const myLatest = new Map<string, string>();
  for (const c of comments ?? []) {
    if (c.author_id === profileId) myLatest.set(c.request_id, c.created_at);
  }

  const unanswered = (comments ?? []).filter(
    (c) =>
      c.author_id !== profileId &&
      (!myLatest.has(c.request_id) ||
        c.created_at > (myLatest.get(c.request_id) as string))
  );
  unanswered.sort((a, b) => b.created_at.localeCompare(a.created_at));

  return unanswered.slice(0, 10).map((c) => ({
    comment_id: c.id,
    body: c.body,
    created_at: c.created_at,
    request_id: c.request_id,
    request_title: titleById.get(c.request_id) ?? "Untitled",
    author_label: c.author?.full_name ?? c.author?.email ?? "Unknown",
  }));
}
