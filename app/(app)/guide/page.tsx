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

export const dynamic = "force-dynamic";

// In-app user guide. Native to the app's design; screenshots are served from
// /public/guide-assets and are cropped to page content (no top nav / no email).

const CHAPTERS = [
  { id: "submit", n: 1, title: "Submitting a request", icon: Plus },
  { id: "dashboard", n: 2, title: "The dashboard", icon: LayoutList },
  { id: "priority", n: 3, title: "Priority & status", icon: ArrowUpDown },
  { id: "mine", n: 4, title: "Your requests", icon: Inbox },
  { id: "templates", n: 5, title: "Workstream templates", icon: Layers },
  { id: "teams", n: 6, title: "Teams & companies", icon: Users },
  { id: "alerts", n: 7, title: "Notifications", icon: Bell },
  { id: "roles", n: 8, title: "Who can do what", icon: ShieldCheck },
] as const;

function Figure({
  src,
  alt,
  caption,
}: {
  src: string;
  alt: string;
  caption: string;
}) {
  return (
    <figure className="my-6 overflow-hidden rounded-xl border bg-card shadow-sm">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="block w-full" loading="lazy" />
      <figcaption className="border-t bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground">
        {caption}
      </figcaption>
    </figure>
  );
}

function ChapterHeading({
  id,
  n,
  title,
  icon: Icon,
  audience,
}: {
  id: string;
  n: number;
  title: string;
  icon: React.ElementType;
  audience?: string;
}) {
  return (
    <div id={id} className="mb-4 scroll-mt-24">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold tabular-nums text-muted-foreground">
              {String(n).padStart(2, "0")}
            </span>
            {audience && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {audience}
              </span>
            )}
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        </div>
      </div>
    </div>
  );
}

export default function GuidePage() {
  return (
    <div className="space-y-12">
      {/* Hero */}
      <header className="overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-8 sm:p-10">
        <div className="flex items-center gap-2 text-primary">
          <BookOpen className="h-5 w-5" />
          <span className="text-xs font-semibold uppercase tracking-[0.12em]">
            User guide
          </span>
        </div>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
          How Beacon works
        </h1>
        <p className="mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
          Beacon is where teams submit product requests, and where workstream
          owners triage and rank them. This guide covers submitting a request,
          reading the dashboard, tracking your own asks, and — for owners and
          admins — shaping what each workstream collects.
        </p>
      </header>

      <div className="lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-12">
        {/* Sticky contents */}
        <aside className="hidden lg:block">
          <nav
            aria-label="Contents"
            className="sticky top-24 space-y-1 border-l pl-4 text-sm"
          >
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Contents
            </p>
            {CHAPTERS.map((c) => (
              <a
                key={c.id}
                href={`#${c.id}`}
                className="flex items-baseline gap-2 rounded-md py-1 text-muted-foreground hover:text-foreground"
              >
                <span className="tabular-nums text-primary/70">
                  {String(c.n).padStart(2, "0")}
                </span>
                <span>{c.title}</span>
              </a>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <div className="min-w-0 max-w-3xl space-y-16 text-[15px] leading-relaxed">
          <section>
            <ChapterHeading {...CHAPTERS[0]} />
            <p>
              Click <strong>New request</strong> in the top bar. The form leads
              with the <strong>Workstream</strong> because that choice shapes
              everything below it — each workstream asks for its own details,
              defined by its owner. Pick a workstream and its fields appear.
            </p>
            <Figure
              src="/guide-assets/g-newrequest.jpeg"
              alt="The New request form, with Workstream first, then Title and a required Summary"
              caption="New request — workstream first. Nothing is written until you Save draft or Submit."
            />
            <ul className="space-y-2 pl-1">
              <li>
                <strong>Nothing is saved until you act.</strong> Filling the form
                creates nothing; only <strong>Save draft</strong> or{" "}
                <strong>Submit to workstream</strong> writes it. Navigate away
                with unsaved changes and Beacon offers to save first.
              </li>
              <li>
                <strong>Summary is always required</strong>; a{" "}
                <strong>workstream is required to submit</strong> (Save draft
                works without one).
              </li>
              <li>
                <strong>Files &amp; dependent teams</strong> attach once the draft
                is saved. A red <span className="text-destructive">*</span> marks
                a required field; a <span className="text-muted-foreground">·</span>{" "}
                dot marks a recommended one you can skip.
              </li>
            </ul>
          </section>

          <section>
            <ChapterHeading {...CHAPTERS[1]} />
            <p>
              The dashboard shows every in-flight request across the org, with
              two tabs — <strong>List</strong> and <strong>Workstreams</strong> —
              both honoring the filters at the top and hiding completed work by
              default. The status cards double as one-tap filters.
            </p>
            <Figure
              src="/guide-assets/g-dashboard.jpeg"
              alt="Dashboard List view with status cards and requests grouped by workstream"
              caption="List view — requests grouped by workstream, each ranked; status + priority editable inline."
            />
            <p>
              The <strong>Workstreams</strong> tab lays every workstream out side
              by side — owning team, a status-mix bar, and its ranked backlog.
              Hover any request for a snapshot of its summary and key fields;
              overdue deadlines show in red.
            </p>
            <Figure
              src="/guide-assets/g-workstreams.jpeg"
              alt="Workstreams board with one card per workstream"
              caption="Workstreams — the whole backlog at a glance, one card per workstream."
            />
          </section>

          <section>
            <ChapterHeading {...CHAPTERS[2]} />
            <p>
              Requests carry <strong>two independent rankings</strong>, edited
              inline on the List view by the people responsible for each:
            </p>
            <ul className="space-y-2 pl-1">
              <li>
                <strong>Team rank</strong> — the requesting team&apos;s order of
                its own requests within a workstream (set by that team&apos;s
                admin).
              </li>
              <li>
                <strong>Workstream rank</strong> — the owning team&apos;s order
                across every request in the workstream (set by the owning-team
                admin).
              </li>
            </ul>
            <p className="mt-3">
              Each control shows <strong>&ldquo;#3 of 7&rdquo;</strong> and nudges
              up/down with the arrows — lower number means higher priority. You
              can only rank within the number of live requests, and{" "}
              <strong>completed requests drop out of the ranking</strong>{" "}
              automatically. Status is set from the same row (admins).
            </p>
            <p className="mt-4 rounded-lg border bg-muted/40 px-4 py-3 text-muted-foreground">
              Every date and time in Beacon is shown in <strong>your</strong>{" "}
              device&apos;s timezone.
            </p>
          </section>

          <section>
            <ChapterHeading {...CHAPTERS[3]} />
            <p>
              <Link
                href="/requests/mine"
                className="text-primary hover:underline"
              >
                My requests
              </Link>{" "}
              is your own view, with a <strong>Hide completed</strong> toggle and
              two tabs: <strong>List</strong> (grouped by workstream; drag to
              reorder your personal priority) and <strong>By workstream</strong>{" "}
              (the same board as the dashboard, scoped to you). A{" "}
              <strong>Tagged — awaiting your reply</strong> sidebar surfaces
              requests where you (or your team) were tagged and haven&apos;t
              replied yet.
            </p>
            <Figure
              src="/guide-assets/g-myrequests.jpeg"
              alt="My requests, By workstream, with the awaiting-your-reply sidebar"
              caption="Your requests by workstream, with tags awaiting your reply in the sidebar."
            />
          </section>

          <section>
            <ChapterHeading {...CHAPTERS[4]} audience="Workstream owners" />
            <p>
              Each workstream decides what a request into it must include. Owners
              edit that from the workstream&apos;s <strong>Template</strong> page
              (owning-team admins via <em>My team → Workstreams</em>; global admins
              via <em>Workstreams</em>).
            </p>
            <Figure
              src="/guide-assets/g-template.jpeg"
              alt="The workstream template editor with built-in fields, custom fields and a preview"
              caption="Template editor — toggle built-ins, add catalog or custom fields, set levels, reorder, preview."
            />
            <ul className="space-y-2 pl-1">
              <li>
                <strong>Built-in fields</strong> — Title and Summary are always
                there; Deadline and Dependent teams are on by default and
                removable per workstream.
              </li>
              <li>
                <strong>Catalog vs. custom</strong> — reuse shared fields, or
                create fields that live only on this workstream; set each to
                required / recommended / optional.
              </li>
              <li>
                <strong>Repo link</strong> gives authors &ldquo;Request
                access&rdquo; / &ldquo;Branch off&rdquo; buttons.{" "}
                <strong>Show draft</strong> previews the exact author form.
              </li>
            </ul>
          </section>

          <section>
            <ChapterHeading {...CHAPTERS[5]} audience="Admins" />
            <p>
              Under <strong>Teams</strong>, people are grouped into teams and
              teams into companies. Search finds a team by name, company, or a
              member&apos;s email — and surfaces that member&apos;s team.
            </p>
            <Figure
              src="/guide-assets/g-teams.jpeg"
              alt="The Teams board grouped by company, with search"
              caption="Teams grouped by company. Open a team to manage members, permissions, company, and Slack."
            />
            <ul className="space-y-2 pl-1">
              <li>
                <strong>Members &amp; roles</strong> — invite by email (a one-time
                password is generated to share), promote a team admin, or grant
                create / edit / delete rights on the team&apos;s workstreams.
              </li>
              <li>
                <strong>Companies</strong> — an admin-managed list a team belongs
                to. <strong>Slack</strong> — connect a channel webhook for alerts.
              </li>
            </ul>
          </section>

          <section>
            <ChapterHeading {...CHAPTERS[6]} />
            <p>
              When a request is <strong>submitted</strong> into a workstream, the
              owning team is alerted on <strong>Slack</strong> (its connected
              channel) and by <strong>email</strong>. When a request&apos;s{" "}
              <strong>status changes</strong>, the owning team gets a lighter{" "}
              <strong>Slack-only</strong> nudge, so ongoing updates don&apos;t
              fill inboxes.
            </p>
            <p className="mt-4 rounded-lg border bg-muted/40 px-4 py-3 text-muted-foreground">
              Slack needs a channel webhook connected on the team; email needs a
              verified sending domain. Until configured, alerts simply
              don&apos;t send — nothing breaks.
            </p>
          </section>

          <section>
            <ChapterHeading {...CHAPTERS[7]} />
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                {
                  role: "Member",
                  body: "Create, save, and submit requests; edit their own; comment; reply to tags; set their personal order in My requests.",
                },
                {
                  role: "Team admin",
                  body: "Everything a member can, plus manage their team's people, rank their team's requester priority, own their workstream templates, and connect Slack.",
                },
                {
                  role: "Global admin",
                  body: "Everything, org-wide: any workstream's template and ranking, request status, the field catalog, statuses, and teams & companies.",
                },
              ].map((r) => (
                <div key={r.role} className="rounded-xl border bg-card p-4 shadow-sm">
                  <div className="text-sm font-semibold">{r.role}</div>
                  <p className="mt-1 text-sm text-muted-foreground">{r.body}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
