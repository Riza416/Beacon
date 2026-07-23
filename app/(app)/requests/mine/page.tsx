import Link from "next/link";
import { LayoutList, Layers } from "lucide-react";
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
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const VIEW_LIST = "list";
const VIEW_WORKSTREAMS = "workstreams";

interface MinePageProps {
  searchParams: Promise<{ view?: string }>;
}

export default async function MineRequestsPage({ searchParams }: MinePageProps) {
  const profile = await requireProfile();
  const { view: viewParam } = await searchParams;
  const view = viewParam === VIEW_WORKSTREAMS ? VIEW_WORKSTREAMS : VIEW_LIST;

  const supabase = await createClient();

  const { data } = await supabase
    .from("requests")
    .select(
      "id, title, summary, state, priority, submitted_at, updated_at, notion_url, status:statuses(id, label, color), product:products(id, name)"
    )
    .eq("author_id", profile.id)
    .order("priority", { ascending: true })
    .order("updated_at", { ascending: false })
    .returns<MyWorkstreamRow[]>();

  const rows = data ?? [];

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

      {rows.length === 0 ? (
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
          <div className="flex items-center gap-1 border-b">
            <Tab
              href="/requests/mine"
              active={view === VIEW_LIST}
              icon={<LayoutList className="h-4 w-4" />}
              label="List"
            />
            <Tab
              href="/requests/mine?view=workstreams"
              active={view === VIEW_WORKSTREAMS}
              icon={<Layers className="h-4 w-4" />}
              label="By workstream"
            />
          </div>

          {view === VIEW_WORKSTREAMS ? (
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
