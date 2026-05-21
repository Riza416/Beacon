import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  MyRequestsSortable,
  type MyRequestRow,
} from "@/components/my-requests-sortable";

export const dynamic = "force-dynamic";

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
    .returns<MyRequestRow[]>();

  const rows = data ?? [];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Your requests
          </h1>
          <p className="text-sm text-muted-foreground">
            Drag rows to reorder by priority. Drafts can be edited; submitted
            requests are read-only.
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
        <MyRequestsSortable initialRows={rows} />
      )}
    </div>
  );
}
