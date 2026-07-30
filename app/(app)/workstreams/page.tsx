import Link from "next/link";
import { Layers, Users, HelpCircle, ArrowRight } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

/**
 * Workstream directory — the self-serve answer to "who do I ask for what?".
 * Every workstream, what it's for, who owns it, and how busy it is, each
 * linking to its homepage.
 */
export default async function WorkstreamsDirectoryPage() {
  await requireProfile();
  const supabase = await createClient();

  const [
    { data: products },
    { data: ownerRows },
    { data: teams },
    { data: statuses },
    { data: requests },
    { data: faqRows },
  ] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, description")
      .order("name")
      .returns<{ id: string; name: string; description: string | null }[]>(),
    supabase
      .from("product_owners")
      .select("product_id, team_id")
      .returns<{ product_id: string; team_id: string }[]>(),
    supabase
      .from("teams")
      .select("id, name")
      .returns<{ id: string; name: string }[]>(),
    supabase
      .from("statuses")
      .select("id, is_terminal")
      .returns<{ id: string; is_terminal: boolean }[]>(),
    supabase
      .from("requests")
      .select("product_id, status_id")
      .eq("state", "submitted")
      .returns<{ product_id: string | null; status_id: string | null }[]>(),
    supabase
      .from("workstream_faqs")
      .select("product_id")
      .returns<{ product_id: string }[]>(),
  ]);

  const teamName = new Map((teams ?? []).map((t) => [t.id, t.name]));
  const ownersByProduct = new Map<string, string[]>();
  for (const o of ownerRows ?? []) {
    const arr = ownersByProduct.get(o.product_id) ?? [];
    const name = teamName.get(o.team_id);
    if (name) arr.push(name);
    ownersByProduct.set(o.product_id, arr);
  }

  const terminal = new Set(
    (statuses ?? []).filter((s) => s.is_terminal).map((s) => s.id)
  );
  const activeByProduct = new Map<string, number>();
  for (const r of requests ?? []) {
    if (!r.product_id) continue;
    if (r.status_id && terminal.has(r.status_id)) continue;
    activeByProduct.set(
      r.product_id,
      (activeByProduct.get(r.product_id) ?? 0) + 1
    );
  }

  const faqCount = new Map<string, number>();
  for (const f of faqRows ?? []) {
    faqCount.set(f.product_id, (faqCount.get(f.product_id) ?? 0) + 1);
  }

  const list = products ?? [];

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Workstreams</h1>
        <p className="text-sm text-muted-foreground">
          What each team takes requests for, who owns it, and the guidance they
          publish. Open one before filing a request.
        </p>
      </header>

      {list.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            No workstreams configured yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((p) => {
            const owners = ownersByProduct.get(p.id) ?? [];
            const active = activeByProduct.get(p.id) ?? 0;
            const faqs = faqCount.get(p.id) ?? 0;
            return (
              <Link key={p.id} href={`/workstreams/${p.id}`} className="group">
                <Card className="h-full transition-colors group-hover:border-primary/40">
                  <CardContent className="flex h-full flex-col gap-3 p-5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <Layers className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <h2 className="truncate font-semibold">{p.name}</h2>
                      </div>
                      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
                        {active} active
                      </span>
                    </div>

                    <p className="line-clamp-2 flex-1 text-sm text-muted-foreground">
                      {p.description || "No description yet."}
                    </p>

                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <Users className="h-3 w-3" />
                      {owners.length > 0 ? (
                        owners.map((name) => (
                          <Badge
                            key={name}
                            variant="secondary"
                            className="text-[10px]"
                          >
                            {name}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400">
                          No owning team yet
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <HelpCircle className="h-3 w-3" />
                        {faqs === 0
                          ? "No FAQs"
                          : `${faqs} FAQ${faqs === 1 ? "" : "s"}`}
                      </span>
                      <span className="inline-flex items-center gap-1 text-primary opacity-0 transition-opacity group-hover:opacity-100">
                        Open
                        <ArrowRight className="h-3 w-3" />
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
