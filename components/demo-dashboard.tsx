import Link from "next/link";
import { Calendar, Layers, LayoutList } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Demo dashboard — a preview of a fully-populated Beacon, shown on the main
// dashboard only when a global admin turns demo mode on. Everything below is
// FICTIONAL sample data held in memory; it is never written to the database,
// so it can't leak to real users or mix with real requests. All names/emails
// are placeholders.

interface DemoStatus {
  label: string;
  color: string;
  terminal?: boolean;
}
const STATUSES: DemoStatus[] = [
  { label: "Backlog", color: "#94a3b8" },
  { label: "In discovery", color: "#f59e0b" },
  { label: "In progress", color: "#6d28d9" },
  { label: "Shipped", color: "#10b981", terminal: true },
];

interface DemoRequest {
  title: string;
  requester: string;
  author: string;
  status: string;
  deadline?: string;
  overdue?: boolean;
}

interface DemoWorkstream {
  name: string;
  owner: string;
  requests: DemoRequest[];
}

const WORKSTREAMS: DemoWorkstream[] = [
  {
    name: "Payments Platform",
    owner: "Payments Eng",
    requests: [
      { title: "Multi-currency settlement", requester: "Treasury", author: "jean-luc.picard@example.com", status: "In progress", deadline: "Aug 12" },
      { title: "Faster ACH return handling", requester: "Ops", author: "kathryn.janeway@example.com", status: "In discovery" },
      { title: "Webhook retries with backoff", requester: "Integrations", author: "benjamin.sisko@example.com", status: "Backlog" },
      { title: "Refund partial-capture support", requester: "Merchant Success", author: "beverly.crusher@example.com", status: "Backlog" },
      { title: "PCI scope reduction", requester: "Security", author: "worf@example.com", status: "Shipped" },
    ],
  },
  {
    name: "Custody & Wallets",
    owner: "Custody Eng",
    requests: [
      { title: "Cold-storage withdrawal approvals", requester: "Risk", author: "data@example.com", status: "In progress", deadline: "Jul 25" },
      { title: "Per-asset withdrawal limits", requester: "Compliance", author: "deanna.troi@example.com", status: "In discovery" },
      { title: "Address allow-listing", requester: "Institutional", author: "geordi.laforge@example.com", status: "Backlog", deadline: "Jul 18", overdue: true },
      { title: "Hardware-key rotation runbook", requester: "SecOps", author: "worf@example.com", status: "Backlog" },
    ],
  },
  {
    name: "Trading Console",
    owner: "Frontend",
    requests: [
      { title: "One-click order cancel-all", requester: "Trading", author: "james.kirk@example.com", status: "In progress" },
      { title: "Dark mode for the trader UI", requester: "Trading", author: "spock@example.com", status: "In discovery" },
      { title: "Depth-chart performance on 4k", requester: "Trading", author: "leonard.mccoy@example.com", status: "Backlog" },
      { title: "Keyboard shortcuts for hotkeys", requester: "Trading", author: "nyota.uhura@example.com", status: "Shipped" },
    ],
  },
  {
    name: "Onboarding & KYC",
    owner: "Platform",
    requests: [
      { title: "Reduce KYC decision latency", requester: "Onboarding", author: "christopher.pike@example.com", status: "In progress", deadline: "Aug 1" },
      { title: "Bulk entity onboarding API", requester: "Institutional", author: "philippa.georgiou@example.com", status: "In discovery" },
      { title: "Document re-verification reminders", requester: "Compliance", author: "michael.burnham@example.com", status: "Backlog" },
    ],
  },
];

const COMMENTS = [
  { author: "spock@example.com", request: "Dark mode for the trader UI", body: "Fascinating — traders on the night desk have asked for this repeatedly. Prioritising.", when: "2h ago" },
  { author: "kathryn.janeway@example.com", request: "Faster ACH return handling", body: "Can we scope the R01/R02 cases first? That's 80% of volume.", when: "5h ago" },
  { author: "worf@example.com", request: "PCI scope reduction", body: "Shipped. Audit evidence attached to the request.", when: "1d ago" },
];

const statusByLabel = new Map(STATUSES.map((s) => [s.label, s]));
const allRequests = WORKSTREAMS.flatMap((w) => w.requests);
const inFlight = allRequests.filter(
  (r) => !statusByLabel.get(r.status)?.terminal
);
const counts = new Map<string, number>();
for (const r of inFlight) counts.set(r.status, (counts.get(r.status) ?? 0) + 1);

export function DemoDashboard() {
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
            <Badge variant="secondary">Demo</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            A preview of Beacon with a full set of requests.
          </p>
        </div>
      </header>

      <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
        <strong>Demo mode is on.</strong>{" "}
        Everything below is fictional sample data, visible only to you — it
        isn&apos;t stored and never appears for real users. Turn demo mode off
        in the top bar to return to live data.
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STATUSES.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: s.color }}
                />
                <span className="text-sm font-medium">{s.label}</span>
              </div>
              <p className="mt-2 text-2xl font-semibold tabular-nums">
                {s.terminal ? "—" : counts.get(s.label) ?? 0}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-lg font-medium">Workstreams</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {WORKSTREAMS.map((w) => {
            const active = w.requests.filter(
              (r) => !statusByLabel.get(r.status)?.terminal
            );
            return (
              <Card key={w.name} className="flex flex-col">
                <div className="flex items-start justify-between gap-2 border-b p-4">
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Layers className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <h3 className="truncate text-sm font-semibold">{w.name}</h3>
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-xs text-muted-foreground">
                        Owned by
                      </span>
                      <Badge variant="secondary" className="text-[10px]">
                        {w.owner}
                      </Badge>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
                    {active.length}
                  </span>
                </div>

                <StatusBar requests={active} />

                <ol className="divide-y">
                  {active.map((r, idx) => {
                    const st = statusByLabel.get(r.status)!;
                    return (
                      <li key={r.title} className="flex items-center gap-3 p-3">
                        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold tabular-nums text-primary">
                          {idx + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {r.title}
                          </p>
                          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span className="truncate">{r.requester}</span>
                            {r.deadline && (
                              <>
                                <span>·</span>
                                <span
                                  className={
                                    r.overdue
                                      ? "inline-flex items-center gap-0.5 font-medium text-destructive"
                                      : "inline-flex items-center gap-0.5"
                                  }
                                >
                                  <Calendar className="h-3 w-3" />
                                  {r.overdue ? "overdue" : `due ${r.deadline}`}
                                </span>
                              </>
                            )}
                          </p>
                        </div>
                        <span
                          className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs"
                          style={{
                            backgroundColor: `${st.color}22`,
                            color: st.color,
                          }}
                        >
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: st.color }}
                          />
                          {st.label}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <LayoutList className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-lg font-medium">Recent comments</h2>
        </div>
        <ul className="space-y-2">
          {COMMENTS.map((c, i) => (
            <li key={i} className="rounded-md border bg-muted/20 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{c.author}</span>
                <span>·</span>
                <span className="font-medium text-foreground">{c.request}</span>
                <span>·</span>
                <span>{c.when}</span>
              </div>
              <p className="mt-1">{c.body}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function StatusBar({ requests }: { requests: DemoRequest[] }) {
  if (requests.length === 0) return null;
  const byStatus = new Map<string, number>();
  for (const r of requests) byStatus.set(r.status, (byStatus.get(r.status) ?? 0) + 1);
  const segments = STATUSES.filter((s) => byStatus.has(s.label)).map((s) => ({
    color: s.color,
    n: byStatus.get(s.label)!,
  }));
  return (
    <div className="flex h-1.5 w-full overflow-hidden">
      {segments.map((seg, i) => (
        <div
          key={i}
          className="h-full"
          style={{
            width: `${(seg.n / requests.length) * 100}%`,
            backgroundColor: seg.color,
          }}
        />
      ))}
    </div>
  );
}
