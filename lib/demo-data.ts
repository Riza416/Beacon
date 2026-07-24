// A single cohesive FICTIONAL world for demo mode. Pure in-memory data + small
// lookup helpers — never touches the database, never leaks to real users. All
// names/emails are placeholders (Star Trek characters at @example.com), and the
// ids cross-link across the demo pages: a project's member request ids resolve
// in demo-request-detail, and each request's projectId resolves in
// demo-project-detail. Tone/naming mirrors components/demo-dashboard.tsx.

export interface DemoStatus {
  label: string;
  color: string;
  terminal?: boolean;
}

export interface DemoPerson {
  name: string;
  email: string;
}

export interface DemoTeam {
  id: string;
  name: string;
}

export interface DemoWorkstream {
  id: string;
  name: string;
  ownerTeamId: string;
}

export interface DemoField {
  label: string;
  value: string;
}

export interface DemoComment {
  author: DemoPerson;
  body: string;
  when: string;
  /** Display names highlighted where they appear as "@Name" in `body`. */
  mentions?: string[];
}

export interface DemoRequest {
  id: string;
  title: string;
  summary: string;
  workstreamId: string;
  teamId: string;
  author: DemoPerson;
  /** Status label; resolve via statusByLabel. */
  status: string;
  deadline?: string;
  overdue?: boolean;
  /** The demo project this request belongs to, if any. */
  projectId?: string;
  /** Request ids this one is blocked by (dependencies). */
  dependsOn?: string[];
  fields: DemoField[];
  comments?: DemoComment[];
}

export interface DemoProject {
  id: string;
  name: string;
  description: string;
  owner: DemoPerson;
  ownerId: string;
  isPrivate: boolean;
  updatedAt: string;
  /** Member request ids (resolve via getDemoRequest). */
  requestIds: string[];
}

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

const PICARD: DemoPerson = { name: "Jean-Luc Picard", email: "jean-luc.picard@example.com" };
const JANEWAY: DemoPerson = { name: "Kathryn Janeway", email: "kathryn.janeway@example.com" };
const SISKO: DemoPerson = { name: "Benjamin Sisko", email: "benjamin.sisko@example.com" };
const WORF: DemoPerson = { name: "Worf", email: "worf@example.com" };
const DATA: DemoPerson = { name: "Data", email: "data@example.com" };
const TROI: DemoPerson = { name: "Deanna Troi", email: "deanna.troi@example.com" };
const LAFORGE: DemoPerson = { name: "Geordi La Forge", email: "geordi.laforge@example.com" };
const KIRK: DemoPerson = { name: "James Kirk", email: "james.kirk@example.com" };
const SPOCK: DemoPerson = { name: "Spock", email: "spock@example.com" };
const UHURA: DemoPerson = { name: "Nyota Uhura", email: "nyota.uhura@example.com" };
const PIKE: DemoPerson = { name: "Christopher Pike", email: "christopher.pike@example.com" };
const GEORGIOU: DemoPerson = { name: "Philippa Georgiou", email: "philippa.georgiou@example.com" };
const BURNHAM: DemoPerson = { name: "Michael Burnham", email: "michael.burnham@example.com" };

/** The persona the demo viewer "is" — drives "My projects" and "Your requests". */
export const DEMO_ME: DemoPerson = PICARD;
export const DEMO_ME_ID = "demo-user-me";

// ---------------------------------------------------------------------------
// Statuses / teams / workstreams
// ---------------------------------------------------------------------------

export const DEMO_STATUSES: DemoStatus[] = [
  { label: "Backlog", color: "#94a3b8" },
  { label: "In discovery", color: "#f59e0b" },
  { label: "In progress", color: "#6d28d9" },
  { label: "Shipped", color: "#10b981", terminal: true },
];

export const statusByLabel = new Map(DEMO_STATUSES.map((s) => [s.label, s]));

export const DEMO_TEAMS: DemoTeam[] = [
  { id: "demo-t1", name: "Payments Eng" },
  { id: "demo-t2", name: "Custody Eng" },
  { id: "demo-t3", name: "Frontend" },
  { id: "demo-t4", name: "Platform" },
];

const teamById = new Map(DEMO_TEAMS.map((t) => [t.id, t]));

export const DEMO_WORKSTREAMS: DemoWorkstream[] = [
  { id: "demo-ws1", name: "Payments Platform", ownerTeamId: "demo-t1" },
  { id: "demo-ws2", name: "Custody & Wallets", ownerTeamId: "demo-t2" },
  { id: "demo-ws3", name: "Trading Console", ownerTeamId: "demo-t3" },
  { id: "demo-ws4", name: "Onboarding & KYC", ownerTeamId: "demo-t4" },
];

const workstreamById = new Map(DEMO_WORKSTREAMS.map((w) => [w.id, w]));

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

export const DEMO_REQUESTS: DemoRequest[] = [
  {
    id: "demo-r1",
    title: "Multi-currency settlement",
    summary:
      "Settle merchant balances in their local currency instead of forcing a USD intermediary. Needs FX rate locking at capture time and a reconciliation report per currency.",
    workstreamId: "demo-ws1",
    teamId: "demo-t1",
    author: PICARD,
    status: "In progress",
    deadline: "Aug 12",
    projectId: "demo-p1",
    dependsOn: ["demo-r3"],
    fields: [
      { label: "Requirements", value: "FX lock at capture, per-currency ledger, daily reconciliation export." },
      { label: "Value", value: "Unblocks EU + LATAM merchant onboarding; removes ~1.2% FX spread complaints." },
    ],
    comments: [
      {
        author: JANEWAY,
        body: "@Jean-Luc Picard can we lock the rate for 30 minutes at capture? Treasury wants a bounded exposure window.",
        when: "3h ago",
        mentions: ["Jean-Luc Picard"],
      },
      {
        author: PICARD,
        body: "Yes — 30 min lock, then re-quote. I'll wire it up once webhook retries land.",
        when: "2h ago",
      },
    ],
  },
  {
    id: "demo-r2",
    title: "Faster ACH return handling",
    summary:
      "Automatically classify and route ACH returns (R01/R02/R03) so ops isn't triaging them by hand.",
    workstreamId: "demo-ws1",
    teamId: "demo-t1",
    author: JANEWAY,
    status: "In discovery",
    projectId: "demo-p1",
    fields: [
      { label: "Requirements", value: "Parse return codes, auto-retry R01, flag R02/R03 for review." },
      { label: "Value", value: "80% of return volume is R01/R02 — automating removes a daily ops queue." },
    ],
    comments: [
      {
        author: JANEWAY,
        body: "Can we scope the R01/R02 cases first? That's 80% of volume.",
        when: "5h ago",
      },
    ],
  },
  {
    id: "demo-r3",
    title: "Webhook retries with backoff",
    summary:
      "Retry failed outbound webhooks with exponential backoff and a dead-letter queue after N attempts.",
    workstreamId: "demo-ws1",
    teamId: "demo-t1",
    author: SISKO,
    status: "Backlog",
    projectId: "demo-p1",
    fields: [
      { label: "Requirements", value: "Exponential backoff, jitter, dead-letter after 8 attempts, replay endpoint." },
      { label: "Value", value: "Integrations lose events during partner outages; retries recover them automatically." },
    ],
  },
  {
    id: "demo-r4",
    title: "Refund partial-capture support",
    summary:
      "Allow refunds against partially-captured authorizations without voiding the whole auth.",
    workstreamId: "demo-ws1",
    teamId: "demo-t1",
    author: PICARD,
    status: "Backlog",
    projectId: "demo-p1",
    dependsOn: ["demo-r1"],
    fields: [
      { label: "Requirements", value: "Track captured vs authorized amount; refund up to captured total." },
      { label: "Value", value: "Merchant Success closes ~30 tickets/month that need manual partial refunds." },
    ],
  },
  {
    id: "demo-r5",
    title: "PCI scope reduction",
    summary:
      "Tokenize card data at the edge so the core platform falls out of PCI DSS scope.",
    workstreamId: "demo-ws1",
    teamId: "demo-t1",
    author: WORF,
    status: "Shipped",
    fields: [
      { label: "Requirements", value: "Edge tokenization, no PAN in app logs, SAQ-A eligibility." },
      { label: "Value", value: "Cuts annual audit cost and removes card data from the core datastore." },
    ],
    comments: [
      {
        author: WORF,
        body: "Shipped. Audit evidence attached to the request.",
        when: "1d ago",
      },
    ],
  },
  {
    id: "demo-r6",
    title: "Cold-storage withdrawal approvals",
    summary:
      "Require multi-party approval before any cold-storage withdrawal is broadcast.",
    workstreamId: "demo-ws2",
    teamId: "demo-t2",
    author: PICARD,
    status: "In progress",
    deadline: "Jul 25",
    projectId: "demo-p2",
    fields: [
      { label: "Requirements", value: "2-of-3 approval, per-approver audit log, hardware-key signing." },
      { label: "Value", value: "Removes single-operator risk on the largest treasury movements." },
    ],
    comments: [
      {
        author: DATA,
        body: "Approval quorum is configurable per vault in the current draft. @Deanna Troi flagged we should default to 3-of-5 for the institutional vault.",
        when: "6h ago",
        mentions: ["Deanna Troi"],
      },
    ],
  },
  {
    id: "demo-r7",
    title: "Per-asset withdrawal limits",
    summary:
      "Configurable daily withdrawal caps per asset, enforced before signing.",
    workstreamId: "demo-ws2",
    teamId: "demo-t2",
    author: TROI,
    status: "In discovery",
    projectId: "demo-p2",
    dependsOn: ["demo-r6"],
    fields: [
      { label: "Requirements", value: "Per-asset caps, rolling 24h window, override with approval." },
      { label: "Value", value: "Compliance needs enforceable limits to satisfy the custody license." },
    ],
  },
  {
    id: "demo-r8",
    title: "Address allow-listing",
    summary:
      "Let institutional clients pre-approve destination addresses with a time-locked cooldown.",
    workstreamId: "demo-ws2",
    teamId: "demo-t2",
    author: LAFORGE,
    status: "Backlog",
    deadline: "Jul 18",
    overdue: true,
    projectId: "demo-p2",
    dependsOn: ["demo-r7"],
    fields: [
      { label: "Requirements", value: "Allow-list per client, 24h cooldown on additions, block off-list withdrawals." },
      { label: "Value", value: "Table-stakes control for institutional custody deals in the pipeline." },
    ],
  },
  {
    id: "demo-r9",
    title: "One-click order cancel-all",
    summary:
      "A single control that cancels every open order across all books instantly.",
    workstreamId: "demo-ws3",
    teamId: "demo-t3",
    author: PICARD,
    status: "In progress",
    projectId: "demo-p3",
    fields: [
      { label: "Requirements", value: "Cancel-all button, confirm dialog, sub-200ms round trip." },
      { label: "Value", value: "Traders need a fast kill switch during volatility spikes." },
    ],
  },
  {
    id: "demo-r10",
    title: "Dark mode for the trader UI",
    summary:
      "A proper dark theme for the trading console — the night desk runs it 12h a day.",
    workstreamId: "demo-ws3",
    teamId: "demo-t3",
    author: SPOCK,
    status: "In discovery",
    projectId: "demo-p3",
    fields: [
      { label: "Requirements", value: "Full dark palette, chart re-theming, respects OS preference." },
      { label: "Value", value: "Reduces eye strain on the overnight desk; most-requested UI ask this quarter." },
    ],
    comments: [
      {
        author: SPOCK,
        body: "Fascinating — traders on the night desk have asked for this repeatedly. Prioritising.",
        when: "2h ago",
      },
      {
        author: UHURA,
        body: "@Spock the depth chart still hardcodes white gridlines — worth folding that into this.",
        when: "1h ago",
        mentions: ["Spock"],
      },
    ],
  },
  {
    id: "demo-r11",
    title: "Keyboard shortcuts for hotkeys",
    summary:
      "Rebindable keyboard shortcuts for the most common trading actions.",
    workstreamId: "demo-ws3",
    teamId: "demo-t3",
    author: UHURA,
    status: "Shipped",
    projectId: "demo-p3",
    fields: [
      { label: "Requirements", value: "Rebindable keys, on-screen cheat sheet, per-user persistence." },
      { label: "Value", value: "Power traders shave seconds off every order entry." },
    ],
  },
  {
    id: "demo-r12",
    title: "Reduce KYC decision latency",
    summary:
      "Cut the median KYC decision time from hours to minutes by parallelising vendor checks.",
    workstreamId: "demo-ws4",
    teamId: "demo-t4",
    author: PICARD,
    status: "In progress",
    deadline: "Aug 1",
    projectId: "demo-p4",
    fields: [
      { label: "Requirements", value: "Parallel vendor calls, cached document extraction, sub-5-min median." },
      { label: "Value", value: "Onboarding drop-off is highest while users wait on KYC." },
    ],
    comments: [
      {
        author: BURNHAM,
        body: "The bottleneck is the sanctions vendor. @Christopher Pike can we run it concurrently with the ID check?",
        when: "4h ago",
        mentions: ["Christopher Pike"],
      },
    ],
  },
  {
    id: "demo-r13",
    title: "Bulk entity onboarding API",
    summary:
      "An API for institutional partners to onboard many sub-entities in one batch.",
    workstreamId: "demo-ws4",
    teamId: "demo-t4",
    author: GEORGIOU,
    status: "In discovery",
    projectId: "demo-p4",
    dependsOn: ["demo-r12"],
    fields: [
      { label: "Requirements", value: "Batch submit, async status webhook, per-entity error reporting." },
      { label: "Value", value: "Unblocks partners onboarding hundreds of entities at once." },
    ],
  },
  {
    id: "demo-r14",
    title: "Document re-verification reminders",
    summary:
      "Automatically remind users to re-verify expiring identity documents.",
    workstreamId: "demo-ws4",
    teamId: "demo-t4",
    author: BURNHAM,
    status: "Backlog",
    projectId: "demo-p4",
    fields: [
      { label: "Requirements", value: "Expiry tracking, staged reminders (30/7/1 day), grace-period lock." },
      { label: "Value", value: "Keeps the book compliant without manual document chasing." },
    ],
  },
];

const requestById = new Map(DEMO_REQUESTS.map((r) => [r.id, r]));

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export const DEMO_PROJECTS: DemoProject[] = [
  {
    id: "demo-p1",
    name: "Q3 Settlement Overhaul",
    description:
      "Everything blocking multi-currency settlement — retries, returns, and partial refunds — tracked together.",
    owner: DEMO_ME,
    ownerId: DEMO_ME_ID,
    isPrivate: false,
    updatedAt: "Jul 22",
    requestIds: ["demo-r1", "demo-r2", "demo-r3", "demo-r4"],
  },
  {
    id: "demo-p2",
    name: "Institutional Custody Launch",
    description:
      "Controls the first institutional custody clients need before go-live: approvals, limits, and allow-listing.",
    owner: DATA,
    ownerId: "demo-user-data",
    isPrivate: false,
    updatedAt: "Jul 21",
    requestIds: ["demo-r6", "demo-r7", "demo-r8"],
  },
  {
    id: "demo-p3",
    name: "Trader UX Refresh",
    description:
      "Quality-of-life upgrades for the trading console the desk uses all day.",
    owner: KIRK,
    ownerId: "demo-user-kirk",
    isPrivate: false,
    updatedAt: "Jul 20",
    requestIds: ["demo-r9", "demo-r10", "demo-r11"],
  },
  {
    id: "demo-p4",
    name: "KYC Latency Taskforce",
    description:
      "Cross-team push to get onboarding decisions under five minutes. Private while targets are being set.",
    owner: BURNHAM,
    ownerId: "demo-user-burnham",
    isPrivate: true,
    updatedAt: "Jul 23",
    requestIds: ["demo-r12", "demo-r13", "demo-r14"],
  },
];

const projectById = new Map(DEMO_PROJECTS.map((p) => [p.id, p]));

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

export function getDemoProject(id: string): DemoProject | undefined {
  return projectById.get(id);
}

export function getDemoRequest(id: string): DemoRequest | undefined {
  return requestById.get(id);
}

export function getDemoTeam(id: string): DemoTeam | undefined {
  return teamById.get(id);
}

export function getDemoWorkstream(id: string): DemoWorkstream | undefined {
  return workstreamById.get(id);
}

/** Requests belonging to a project, in the project's declared order. */
export function requestsInProject(projectId: string): DemoRequest[] {
  const project = projectById.get(projectId);
  if (!project) return [];
  return project.requestIds
    .map((rid) => requestById.get(rid))
    .filter((r): r is DemoRequest => Boolean(r));
}

/** The project a request belongs to, if any. */
export function projectOfRequest(requestId: string): DemoProject | undefined {
  const req = requestById.get(requestId);
  if (!req?.projectId) return undefined;
  return projectById.get(req.projectId);
}

/**
 * Resolved dependencies (blockers) of a request. Only surfaces blockers that
 * live in the same project, mirroring the real project-detail behaviour.
 */
export function dependenciesOfRequest(
  requestId: string
): { id: string; title: string }[] {
  const req = requestById.get(requestId);
  if (!req?.dependsOn) return [];
  return req.dependsOn
    .map((depId) => requestById.get(depId))
    .filter((d): d is DemoRequest => Boolean(d))
    .filter((d) => !req.projectId || d.projectId === req.projectId)
    .map((d) => ({ id: d.id, title: d.title }));
}

/** Requests authored by the demo viewer ("Your requests"). */
export function myDemoRequests(): DemoRequest[] {
  return DEMO_REQUESTS.filter((r) => r.author.email === DEMO_ME.email);
}

/** Projects owned by the demo viewer ("My projects"). */
export function myDemoProjects(): DemoProject[] {
  return DEMO_PROJECTS.filter((p) => p.ownerId === DEMO_ME_ID);
}
