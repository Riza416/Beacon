import Link from "next/link";
import {
  ArrowUpDown,
  Bell,
  BookOpen,
  Inbox,
  Layers,
  LayoutList,
  Plus,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

// In-app user guide. Native to the app's design (no screenshots), so it carries
// no data, stays in sync with the product, and is safe to ship.

interface Chapter {
  id: string;
  n: number;
  title: string;
  icon: React.ReactNode;
  audience?: string;
}

const CHAPTERS: Chapter[] = [
  { id: "submit", n: 1, title: "Submitting a request", icon: <Plus className="h-4 w-4" /> },
  { id: "dashboard", n: 2, title: "The dashboard", icon: <LayoutList className="h-4 w-4" /> },
  { id: "priority", n: 3, title: "Priority & status", icon: <ArrowUpDown className="h-4 w-4" /> },
  { id: "mine", n: 4, title: "Your requests", icon: <Inbox className="h-4 w-4" /> },
  { id: "templates", n: 5, title: "Workstream templates", icon: <Layers className="h-4 w-4" />, audience: "Workstream owners" },
  { id: "teams", n: 6, title: "Teams & companies", icon: <Users className="h-4 w-4" />, audience: "Admins" },
  { id: "alerts", n: 7, title: "Notifications", icon: <Bell className="h-4 w-4" /> },
  { id: "roles", n: 8, title: "Who can do what", icon: <ShieldCheck className="h-4 w-4" /> },
];

function SectionHeader({ chapter }: { chapter: Chapter }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        {chapter.icon}
      </span>
      <div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold tabular-nums text-muted-foreground">
            {String(chapter.n).padStart(2, "0")}
          </span>
          <h2 className="text-lg font-semibold tracking-tight">
            {chapter.title}
          </h2>
        </div>
        {chapter.audience && (
          <span className="text-xs text-muted-foreground">
            {chapter.audience}
          </span>
        )}
      </div>
    </div>
  );
}

/** A required-level legend chip mirroring the request form. */
function LevelChip({
  mark,
  label,
  tone,
}: {
  mark: string;
  label: string;
  tone: "req" | "rec";
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={
          tone === "req"
            ? "font-semibold text-destructive"
            : "text-muted-foreground"
        }
      >
        {mark}
      </span>
      <span className="text-sm">{label}</span>
    </span>
  );
}

export default function GuidePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-primary">
          <BookOpen className="h-5 w-5" />
          <span className="text-xs font-semibold uppercase tracking-wide">
            User guide
          </span>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">
          How Beacon works
        </h1>
        <p className="text-[15px] text-muted-foreground">
          Beacon is where teams submit product requests, and where workstream
          owners triage and rank them. This guide covers submitting a request,
          reading the dashboard, tracking your own asks, and — for owners and
          admins — shaping what each workstream collects.
        </p>
      </header>

      <nav aria-label="Contents" className="grid grid-cols-1 gap-1.5 rounded-2xl border bg-card p-4 shadow-sm sm:grid-cols-2">
        {CHAPTERS.map((c) => (
          <a
            key={c.id}
            href={`#${c.id}`}
            className="flex items-baseline gap-2 rounded-md px-2 py-1.5 text-sm text-foreground hover:bg-accent"
          >
            <span className="tabular-nums text-primary">
              {String(c.n).padStart(2, "0")}
            </span>
            <span>{c.title}</span>
          </a>
        ))}
      </nav>

      {/* 1 — Submit */}
      <section id="submit" className="scroll-mt-20 space-y-3">
        <SectionHeader chapter={CHAPTERS[0]} />
        <Card>
          <CardContent className="space-y-4 p-5 text-sm leading-relaxed">
            <p>
              Click <strong>New request</strong> in the top bar. The form leads
              with the <strong>Workstream</strong> because that choice shapes
              everything below it — each workstream asks for its own details,
              defined by its owner.
            </p>
            <ul className="space-y-2">
              <li>
                <strong>Nothing is saved until you act.</strong> Filling the form
                creates nothing; only <strong>Save draft</strong> or{" "}
                <strong>Submit to workstream</strong> writes it. Navigate away
                with unsaved changes and Beacon offers to save the draft first.
              </li>
              <li>
                <strong>Summary is always required; a workstream is required to
                submit.</strong> Save draft works without a workstream; submitting
                doesn&apos;t.
              </li>
              <li>
                <strong>Files &amp; dependent teams</strong> attach once the draft
                is saved — save first if you want to add them.
              </li>
            </ul>
            <div className="flex flex-wrap items-center gap-4 rounded-lg bg-muted/40 px-4 py-3">
              <LevelChip mark="*" label="Required to submit" tone="req" />
              <LevelChip mark="·" label="Recommended (you can skip it)" tone="rec" />
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 2 — Dashboard */}
      <section id="dashboard" className="scroll-mt-20 space-y-3">
        <SectionHeader chapter={CHAPTERS[1]} />
        <Card>
          <CardContent className="space-y-4 p-5 text-sm leading-relaxed">
            <p>
              The dashboard shows every in-flight request across the org, with
              two tabs — both honoring the filters at the top (workstream, team,
              status, author) and hiding completed work by default.
            </p>
            <ul className="space-y-2">
              <li>
                <Badge variant="secondary">List</Badge> — requests grouped by
                workstream and ranked within each. The status summary cards
                double as one-tap filters.
              </li>
              <li>
                <Badge variant="secondary">Workstreams</Badge> — every workstream
                side by side: owning team, a status-mix bar, and its ranked
                backlog. <strong>Hover any request</strong> for a snapshot of its
                summary and key fields without leaving the board. Overdue
                deadlines show in red.
              </li>
            </ul>
          </CardContent>
        </Card>
      </section>

      {/* 3 — Priority */}
      <section id="priority" className="scroll-mt-20 space-y-3">
        <SectionHeader chapter={CHAPTERS[2]} />
        <Card>
          <CardContent className="space-y-4 p-5 text-sm leading-relaxed">
            <p>
              Requests carry <strong>two independent rankings</strong>, edited
              inline on the List view by the people responsible for each:
            </p>
            <ul className="space-y-2">
              <li>
                <Badge variant="outline">Team rank</Badge> — the requesting
                team&apos;s order of <em>its own</em> requests within a
                workstream. Set by that team&apos;s admin (and global admins).
              </li>
              <li>
                <Badge variant="outline">Workstream rank</Badge> — the owning
                team&apos;s order across <em>every</em> request in the workstream.
                Set by the owning-team admin (and global admins).
              </li>
            </ul>
            <p>
              Each control shows <strong>&ldquo;#3 of 7&rdquo;</strong> and nudges
              up/down with the arrows — lower number means higher priority. You
              can only rank within the number of live requests in that group, and{" "}
              <strong>completed requests drop out of the ranking</strong>{" "}
              automatically. Status is set from the same row (admins).
            </p>
            <p className="rounded-lg bg-muted/40 px-4 py-3 text-muted-foreground">
              Every date and time in Beacon is shown in <strong>your</strong>{" "}
              device&apos;s timezone.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* 4 — My requests */}
      <section id="mine" className="scroll-mt-20 space-y-3">
        <SectionHeader chapter={CHAPTERS[3]} />
        <Card>
          <CardContent className="space-y-4 p-5 text-sm leading-relaxed">
            <p>
              <Link href="/requests/mine" className="text-primary hover:underline">
                My requests
              </Link>{" "}
              is your own view, with a <strong>Hide completed</strong> toggle and
              two tabs:
            </p>
            <ul className="space-y-2">
              <li>
                <Badge variant="secondary">List</Badge> — your requests grouped by
                workstream; drag to reorder your personal priority within each
                group.
              </li>
              <li>
                <Badge variant="secondary">By workstream</Badge> — the same board
                as the dashboard (cards, status bar, hover snapshot), scoped to
                just your requests.
              </li>
            </ul>
            <p>
              A <strong>Tagged — awaiting your reply</strong> sidebar lists
              requests where you (or your team) were tagged for input and{" "}
              haven&apos;t replied yet. Open one, leave a comment, and it clears.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* 5 — Templates */}
      <section id="templates" className="scroll-mt-20 space-y-3">
        <SectionHeader chapter={CHAPTERS[4]} />
        <Card>
          <CardContent className="space-y-4 p-5 text-sm leading-relaxed">
            <p>
              Each workstream decides what a request into it must include. Owners
              edit that from the workstream&apos;s <strong>Template</strong> page
              (owning-team admins via <em>My team → Workstreams</em>; global admins
              via <em>Workstreams</em>).
            </p>
            <ul className="space-y-2">
              <li>
                <strong>Built-in fields</strong> — Title and Summary are always
                there; Deadline and Dependent teams are on by default and can be
                removed per workstream.
              </li>
              <li>
                <strong>Catalog vs. custom</strong> — reuse shared fields admins
                maintain, or create fields that live only on this workstream. Set
                each to required, recommended, or optional, and reorder them.
              </li>
              <li>
                <strong>Repo link</strong> — attach a repository so authors get
                &ldquo;Request access&rdquo; and &ldquo;Branch off&rdquo; buttons.
              </li>
              <li>
                <strong>Show draft</strong> previews the exact form authors will
                see.
              </li>
            </ul>
          </CardContent>
        </Card>
      </section>

      {/* 6 — Teams */}
      <section id="teams" className="scroll-mt-20 space-y-3">
        <SectionHeader chapter={CHAPTERS[5]} />
        <Card>
          <CardContent className="space-y-4 p-5 text-sm leading-relaxed">
            <p>
              Under <strong>Teams</strong>, people are grouped into teams and
              teams into companies. Search finds a team by name, by company, or by
              a member&apos;s email — and surfaces that member&apos;s team.
            </p>
            <ul className="space-y-2">
              <li>
                <strong>Members &amp; roles</strong> — invite by email (a one-time
                password is generated to share), promote a team admin, or grant a
                member create / edit / delete rights on the team&apos;s
                workstreams.
              </li>
              <li>
                <strong>Companies</strong> — an admin-managed list a team can
                belong to.
              </li>
              <li>
                <strong>Slack</strong> — connect a channel&apos;s incoming-webhook
                so the team gets alerts.
              </li>
            </ul>
          </CardContent>
        </Card>
      </section>

      {/* 7 — Notifications */}
      <section id="alerts" className="scroll-mt-20 space-y-3">
        <SectionHeader chapter={CHAPTERS[6]} />
        <Card>
          <CardContent className="space-y-4 p-5 text-sm leading-relaxed">
            <p>
              When a request is <strong>submitted</strong> into a workstream, the
              owning team is alerted on <strong>Slack</strong> (its connected
              channel) and by <strong>email</strong> (each member). When a
              request&apos;s <strong>status changes</strong>, the owning team gets
              a lighter <strong>Slack-only</strong> nudge, so ongoing updates
              don&apos;t fill inboxes.
            </p>
            <p className="rounded-lg bg-muted/40 px-4 py-3 text-muted-foreground">
              Slack needs a channel webhook connected on the team; email needs a
              verified sending domain. Until configured, alerts simply
              don&apos;t send — nothing breaks.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* 8 — Roles */}
      <section id="roles" className="scroll-mt-20 space-y-3">
        <SectionHeader chapter={CHAPTERS[7]} />
        <Card>
          <CardContent className="space-y-4 p-5 text-sm leading-relaxed">
            <dl className="space-y-3">
              <div>
                <dt className="font-semibold">Member</dt>
                <dd className="text-muted-foreground">
                  Create, save, and submit requests; edit their own; comment;
                  reply to tags; set their personal order in My requests.
                </dd>
              </div>
              <div>
                <dt className="font-semibold">Team admin</dt>
                <dd className="text-muted-foreground">
                  Everything a member can, plus: manage their team&apos;s people,
                  rank their team&apos;s requester priority, own and edit their
                  team&apos;s workstream templates, and connect the team&apos;s
                  Slack channel.
                </dd>
              </div>
              <div>
                <dt className="font-semibold">Global admin</dt>
                <dd className="text-muted-foreground">
                  Everything, org-wide: any workstream&apos;s template and ranking,
                  request status, the field catalog, statuses, and teams &amp;
                  companies.
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
