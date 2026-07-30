import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Layers,
  Users,
  Plus,
  HelpCircle,
  ListChecks,
  Settings,
} from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canEditProducts } from "@/lib/actions/utils";
import { resolveFieldsForProduct } from "@/lib/workstream-template";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LocalTime } from "@/components/local-time";
import { RepoActions } from "@/components/repo-actions";
import { FaqManager, type FaqItem } from "@/components/faq-manager";
import type { FieldDefinition } from "@/lib/types";

export const dynamic = "force-dynamic";

interface BacklogRow {
  id: string;
  title: string;
  status_id: string | null;
  workstream_priority: number;
  deadline: string | null;
  updated_at: string;
  is_private: boolean;
  status: { label: string; color: string; is_terminal: boolean } | null;
  team: { name: string } | null;
  supporters: { count: number }[] | null;
}

/**
 * A workstream's homepage: what it's for, who owns it, what it asks for, the
 * current backlog, and the owning team's own guidance (FAQs) for requesters.
 */
export default async function WorkstreamHomePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: product } = await supabase
    .from("products")
    .select("id, name, description, show_deadline, show_dependent_teams")
    .eq("id", id)
    .maybeSingle<{
      id: string;
      name: string;
      description: string | null;
      show_deadline: boolean;
      show_dependent_teams: boolean;
    }>();
  if (!product) notFound();

  const [
    fields,
    { data: ownerRows },
    { data: statuses },
    { data: backlogRows },
    { data: faqs },
  ] = await Promise.all([
    resolveFieldsForProduct(supabase, id),
    supabase
      .from("product_owners")
      .select("team_id, team:teams(name)")
      .eq("product_id", id)
      .returns<{ team_id: string; team: { name: string } | null }[]>(),
    supabase
      .from("statuses")
      .select("id, label, is_default, is_terminal")
      .order("display_order")
      .returns<
        { id: string; label: string; is_default: boolean; is_terminal: boolean }[]
      >(),
    supabase
      .from("requests")
      .select(
        "id, title, status_id, workstream_priority, deadline, updated_at, is_private, " +
          "status:statuses(label, color, is_terminal), " +
          "team:teams!requests_team_id_fkey(name), " +
          "supporters:request_supporters(count)"
      )
      .eq("product_id", id)
      .eq("state", "submitted")
      .order("workstream_priority", { ascending: true })
      .limit(200)
      .returns<BacklogRow[]>(),
    supabase
      .from("workstream_faqs")
      .select("id, question, answer")
      .eq("product_id", id)
      .order("display_order", { ascending: true })
      .returns<FaqItem[]>(),
  ]);

  const owners = (ownerRows ?? [])
    .map((o) => o.team?.name)
    .filter((n): n is string => Boolean(n));
  const owningTeamIds = (ownerRows ?? []).map((o) => o.team_id);

  // Who may publish guidance here: a global admin, or an owning-team member
  // allowed to edit workstreams (mirrors can_manage_workstream in 0033).
  const canManage =
    profile.role === "admin" ||
    (canEditProducts(profile) &&
      profile.team_id !== null &&
      owningTeamIds.includes(profile.team_id));

  const defaultStatusId =
    (statuses ?? []).find((s) => s.is_default)?.id ?? null;
  const rows = backlogRows ?? [];
  const active = rows.filter((r) => !r.status?.is_terminal);
  const completed = rows.length - active.length;
  // "Awaiting triage" = still unset, or sitting at the default (New) status.
  const awaitingTriage = active.filter(
    (r) => !r.status_id || r.status_id === defaultStatusId
  ).length;

  const requiredFields = fields.filter((f) => f.required_level === "hard");
  const repoFields = fields.filter(
    (f) => f.repo_url && (f.field_types ?? []).includes("repo")
  );

  const stats = [
    { label: "Active", value: active.length },
    {
      label: "Awaiting triage",
      value: awaitingTriage,
      alert: awaitingTriage > 0,
    },
    { label: "Completed", value: completed },
  ];

  return (
    <div className="space-y-8">
      <header className="space-y-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          <Link href="/workstreams" className="hover:underline">
            Workstreams
          </Link>{" "}
          /
        </p>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 shrink-0 text-muted-foreground" />
              <h1 className="text-2xl font-semibold tracking-tight">
                {product.name}
              </h1>
            </div>
            <p className="max-w-2xl text-sm text-muted-foreground">
              {product.description ||
                "No description yet — the owning team can add one."}
            </p>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              <span>Owned by</span>
              {owners.length > 0 ? (
                owners.map((name) => (
                  <Badge key={name} variant="secondary">
                    {name}
                  </Badge>
                ))
              ) : (
                <span className="font-medium text-amber-600 dark:text-amber-400">
                  nobody yet — an admin should assign an owning team
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild size="sm">
              <Link href={`/requests/new?product=${product.id}`}>
                <Plus className="mr-1.5 h-4 w-4" />
                New request
              </Link>
            </Button>
            {canManage && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/team/products/${product.id}/template`}>
                  <Settings className="mr-1.5 h-4 w-4" />
                  Edit template
                </Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      <section className="grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p
                className={`mt-1 text-2xl font-semibold tabular-nums ${
                  s.alert ? "text-amber-600 dark:text-amber-400" : ""
                }`}
              >
                {s.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
                FAQs &amp; guidance
              </CardTitle>
              <CardDescription>
                {canManage
                  ? "Publish guidance for the teams that file requests here — what belongs in this workstream, how to scope an ask, links to docs."
                  : "Guidance from the owning team. Worth a read before filing a request."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FaqManager
                productId={product.id}
                faqs={faqs ?? []}
                canManage={canManage}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Current backlog</CardTitle>
              <CardDescription>
                Active requests in this workstream, in the owning team&apos;s
                priority order.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {active.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">
                  Nothing active right now.
                </p>
              ) : (
                <ol className="divide-y">
                  {active.slice(0, 25).map((r, idx) => {
                    const votes = r.supporters?.[0]?.count ?? 0;
                    const overdue = r.deadline
                      ? new Date(r.deadline) < new Date()
                      : false;
                    return (
                      <li
                        key={r.id}
                        className="flex items-center gap-3 p-3 sm:px-4"
                      >
                        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold tabular-nums text-primary">
                          {idx + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/requests/${r.id}`}
                            className="block truncate text-sm font-medium hover:underline"
                          >
                            {r.title || "Untitled request"}
                          </Link>
                          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                            {r.team?.name && <span>{r.team.name}</span>}
                            {r.deadline && (
                              <>
                                <span>·</span>
                                <span
                                  className={
                                    overdue
                                      ? "font-medium text-destructive"
                                      : undefined
                                  }
                                >
                                  due{" "}
                                  <LocalTime value={r.deadline} mode="date" />
                                </span>
                              </>
                            )}
                          </p>
                        </div>
                        {votes > 0 && (
                          <span className="shrink-0 rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-primary">
                            +{votes}
                          </span>
                        )}
                        {r.status && (
                          <span
                            className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs"
                            style={{
                              backgroundColor: `${r.status.color}22`,
                              color: r.status.color,
                            }}
                          >
                            {r.status.label}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ListChecks className="h-4 w-4 text-muted-foreground" />
                What to include
              </CardTitle>
              <CardDescription>
                This workstream&apos;s request form asks for these.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {fields.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Just a title and summary — no extra fields configured.
                </p>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  <li className="flex items-center gap-2">
                    <span>Summary</span>
                    <Badge variant="outline" className="text-[10px]">
                      required
                    </Badge>
                  </li>
                  {fields.map((f: FieldDefinition) => (
                    <li key={f.id} className="flex items-center gap-2">
                      <span className="min-w-0 truncate">{f.label}</span>
                      {f.required_level === "hard" && (
                        <Badge variant="outline" className="text-[10px]">
                          required
                        </Badge>
                      )}
                      {f.required_level === "soft" && (
                        <span className="text-xs text-muted-foreground">
                          recommended
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {product.show_deadline && (
                <p className="text-xs text-muted-foreground">
                  A deadline can be set on requests here.
                </p>
              )}
              {requiredFields.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Requests can&apos;t be submitted without the required fields.
                </p>
              )}
            </CardContent>
          </Card>

          {repoFields.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Repositories</CardTitle>
                <CardDescription>
                  Request access or branch off directly.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {repoFields.map((f) => (
                  <div key={f.id} className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">
                      {f.label}
                    </p>
                    <RepoActions url={f.repo_url as string} />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}
