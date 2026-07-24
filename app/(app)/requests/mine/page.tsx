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
import { type SnapshotField } from "@/components/workstream-request-row";
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

  // Authored rows carry `deadline` (a requests column); `fields` for the board
  // snapshot are attached separately below from request_field_values.
  type AuthoredRow = Omit<MyWorkstreamRow, "fields" | "tagged">;

  const { data } = await supabase
    .from("requests")
    .select(
      "id, title, summary, state, priority, submitted_at, updated_at, notion_url, deadline, is_private, status:statuses(id, label, color, is_terminal), product:products(id, name)"
    )
    .eq("author_id", profile.id)
    .order("priority", { ascending: true })
    .order("updated_at", { ascending: false })
    .returns<AuthoredRow[]>();

  const authored = data ?? [];
  const tagged = await fetchTaggedAwaitingReply(profile);

  const applyHideDone = <T extends { status: { is_terminal: boolean } | null }>(
    list: T[]
  ) => (hideDone ? list.filter((r) => !r.status?.is_terminal) : list);

  // List view = only your own requests (you can reorder those). The sortable
  // ignores deadline/fields, so the raw authored rows are the right shape.
  const listRows = applyHideDone(authored);

  // Snapshot custom-field values for the board (your own requests), keyed by id.
  const snapshotFields = await fetchSnapshotFields(
    supabase,
    authored.map((r) => r.id)
  );

  // By-workstream view shows ONLY your own requests, grouped by workstream.
  // (Requests you're tagged on live in the "awaiting your reply" callout above.)
  const boardRows: MyWorkstreamRow[] = applyHideDone(
    authored.map((r) => ({
      ...r,
      fields: snapshotFields.get(r.id) ?? [],
      tagged: false,
    }))
  );

  const doneCount = authored.filter((r) => r.status?.is_terminal).length;

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

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1 space-y-4">
          {authored.length === 0 ? (
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

          {view === VIEW_WORKSTREAMS ? (
            boardRows.length === 0 ? (
              <AllDoneCard />
            ) : (
              <MyRequestsByWorkstream rows={boardRows} />
            )
          ) : listRows.length === 0 ? (
            <AllDoneCard />
          ) : (
            <MyRequestsSortable initialRows={listRows} />
          )}
            </>
          )}
        </div>

        {tagged.length > 0 && (
          <aside className="lg:w-80 lg:shrink-0">
            <section className="space-y-2 rounded-2xl border border-amber-500/40 bg-amber-500/5 p-4 lg:sticky lg:top-6">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <MessageSquare className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                Tagged — awaiting your reply ({tagged.length})
              </h2>
              <ul className="space-y-2">
                {tagged.map((t) => (
                  <li
                    key={t.id}
                    className="rounded-md border bg-background p-3 text-sm"
                  >
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>from {t.from}</span>
                      <span>·</span>
                      <Link
                        href={`/requests/${t.id}`}
                        className="font-medium text-foreground hover:underline"
                      >
                        {t.title}
                      </Link>
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      <LocalTime value={t.updatedAt} />
                    </div>
                    {t.summary && (
                      <p className="mt-1 line-clamp-2">{t.summary}</p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          </aside>
        )}
      </div>
    </div>
  );
}

function AllDoneCard() {
  return (
    <Card>
      <CardContent className="p-8 text-center text-sm text-muted-foreground">
        All your requests are completed — untick &ldquo;Hide completed&rdquo; to
        see them.
      </CardContent>
    </Card>
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

interface TaggedAwaitingReply {
  id: string;
  title: string;
  summary: string | null;
  from: string;
  updatedAt: string;
  deadline: string | null;
  product: { id: string; name: string } | null;
  status: {
    id: string;
    label: string;
    color: string;
    is_terminal: boolean;
  } | null;
}

interface TaggedRequestRow {
  id: string;
  title: string;
  summary: string | null;
  updated_at: string;
  deadline: string | null;
  team: { name: string } | null;
  author: { full_name: string | null; email: string | null } | null;
  product: { id: string; name: string } | null;
  status: {
    id: string;
    label: string;
    color: string;
    is_terminal: boolean;
  } | null;
}

/**
 * Requests where the current user is tagged — directly, or via their team —
 * and hasn't replied yet (no comment of their own on the request). These are
 * the tags still waiting on them. Excludes their own authored requests.
 */
async function fetchTaggedAwaitingReply(profile: {
  id: string;
  team_id: string | null;
}): Promise<TaggedAwaitingReply[]> {
  const supabase = await createClient();

  const { data: directRows } = await supabase
    .from("request_collaborators")
    .select("request_id")
    .eq("user_id", profile.id)
    .returns<{ request_id: string }[]>();

  let teamTaggedIds: string[] = [];
  if (profile.team_id) {
    const { data: teamRows } = await supabase
      .from("request_team_tags")
      .select("request_id")
      .eq("team_id", profile.team_id)
      .returns<{ request_id: string }[]>();
    teamTaggedIds = (teamRows ?? []).map((r) => r.request_id);
  }

  const taggedIds = Array.from(
    new Set([
      ...(directRows ?? []).map((r) => r.request_id),
      ...teamTaggedIds,
    ])
  );
  if (taggedIds.length === 0) return [];

  const { data: reqs } = await supabase
    .from("requests")
    .select(
      "id, title, summary, updated_at, deadline, " +
        "team:teams!requests_team_id_fkey(name), " +
        "author:profiles!requests_author_id_fkey(full_name, email), " +
        "product:products(id, name), " +
        "status:statuses(id, label, color, is_terminal)"
    )
    .in("id", taggedIds)
    .neq("author_id", profile.id) // not the user's own requests
    .order("updated_at", { ascending: false })
    .returns<TaggedRequestRow[]>();

  const reqIds = (reqs ?? []).map((r) => r.id);
  if (reqIds.length === 0) return [];

  // Which of these the user has already replied to (any comment of theirs).
  const { data: myComments } = await supabase
    .from("comments")
    .select("request_id")
    .eq("author_id", profile.id)
    .in("request_id", reqIds)
    .returns<{ request_id: string }[]>();
  const repliedTo = new Set((myComments ?? []).map((c) => c.request_id));

  return (reqs ?? [])
    .filter((r) => !repliedTo.has(r.id))
    .slice(0, 10)
    .map((r) => ({
      id: r.id,
      title: r.title || "Untitled request",
      summary: r.summary,
      from: r.author?.full_name ?? r.author?.email ?? r.team?.name ?? "Unknown",
      updatedAt: r.updated_at,
      deadline: r.deadline,
      product: r.product,
      status: r.status,
    }));
}

// ---------------------------------------------------------------------------
// Board hover-snapshot: a request's filled custom-field values (Requirements,
// Value, …), keyed by request id. Mirrors the dashboard's helper so the
// By-workstream board shows the same snapshot content.
// ---------------------------------------------------------------------------

function formatSnapshotValue(
  type: string,
  valueText: string | null
): { text: string } | { chips: string[] } | null {
  if (type === "multi_select") {
    if (!valueText) return null;
    try {
      const arr = JSON.parse(valueText);
      const chips = Array.isArray(arr)
        ? arr.filter((x): x is string => typeof x === "string")
        : [];
      return chips.length ? { chips } : null;
    } catch {
      return null;
    }
  }
  if (type === "checkbox") return valueText === "true" ? { text: "Yes" } : null;
  // Files/images (no text) and the owner-set repo link aren't author content.
  if (type === "file" || type === "image" || type === "repo") return null;
  const t = (valueText ?? "").trim();
  return t.length > 0 ? { text: t } : null;
}

async function fetchSnapshotFields(
  supabase: Awaited<ReturnType<typeof createClient>>,
  requestIds: string[]
): Promise<Map<string, SnapshotField[]>> {
  const map = new Map<string, SnapshotField[]>();
  if (requestIds.length === 0) return map;

  const { data } = await supabase
    .from("request_field_values")
    .select(
      "request_id, field_type, value_text, definition:request_field_definitions(label)"
    )
    .in("request_id", requestIds)
    .returns<
      {
        request_id: string;
        field_type: string;
        value_text: string | null;
        definition: { label: string } | null;
      }[]
    >();

  for (const row of data ?? []) {
    if (!row.definition) continue;
    const formatted = formatSnapshotValue(row.field_type, row.value_text);
    if (!formatted) continue;
    const arr = map.get(row.request_id) ?? [];
    arr.push({ label: row.definition.label, ...formatted });
    map.set(row.request_id, arr);
  }
  return map;
}
