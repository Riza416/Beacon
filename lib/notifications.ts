// Workstream-owner alerts (Slack + email).
//
// When a request is submitted into a workstream, or its status changes, the
// team(s) that OWN that workstream are alerted:
//   • Slack — one message per owning team that has configured a webhook, posted
//     to that team's channel.
//   • Email — one message per owning-team member (minus the actor), if email is
//     configured (RESEND_API_KEY / EMAIL_FROM).
// Both are optional and independent; whichever is configured fires.
//
// Everything runs through the service-role client because the alert crosses
// team boundaries (a submitter on team A triggers alerts to owning team B) and
// the Slack webhook is a secret with admin-only RLS. That's safe: this function
// is only ever called from an already-authorized mutation, reads only what it
// needs to address the alert, and grants the caller nothing.
//
// Every failure is swallowed and logged: a notification must never break the
// underlying create/update the user just performed.

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailConfigured, escapeHtml, sendEmail } from "@/lib/email";
import {
  sendSlackMessage,
  sendSlackDm,
  slackDmConfigured,
  slackEscape,
} from "@/lib/slack";
import type { Database } from "@/lib/database.types";

type DB = SupabaseClient<Database>;

export type WorkstreamEvent =
  | { kind: "submitted" }
  | { kind: "status_changed"; statusLabel: string }
  | { kind: "unacknowledged"; days: number }
  | { kind: "deadline_soon"; deadline: string };

/** Update relayed to the requester + watchers (the "your request" audience). */
export type RequestUpdateEvent =
  | { kind: "status_changed"; statusLabel: string }
  | { kind: "declined"; statusLabel: string; reason: string | null }
  | { kind: "deadline_soon"; deadline: string };

interface RequestForNotify {
  id: string;
  title: string | null;
  product_id: string | null;
  team_id: string | null;
  author_id: string;
  team: { name: string } | null;
  product: { name: string } | null;
}

export async function notifyWorkstreamOwners(opts: {
  requestId: string;
  actorId: string;
  event: WorkstreamEvent;
  /** Which channels to use. Defaults to both. */
  channels?: ("slack" | "email")[];
}): Promise<void> {
  try {
    const channels = opts.channels ?? ["slack", "email"];
    const admin = createAdminClient();

    const { data: req, error: reqErr } = await admin
      .from("requests")
      .select(
        "id, title, product_id, team_id, author_id, " +
          "team:teams!requests_team_id_fkey(name), " +
          "product:products(name)"
      )
      .eq("id", opts.requestId)
      .maybeSingle<RequestForNotify>();
    if (reqErr) throw new Error(reqErr.message);
    if (!req || !req.product_id) return; // no workstream → nobody owns it

    const { data: ownerRows, error: ownErr } = await admin
      .from("product_owners")
      .select("team_id")
      .eq("product_id", req.product_id);
    if (ownErr) throw new Error(ownErr.message);
    const teamIds = [...new Set((ownerRows ?? []).map((o) => o.team_id))];
    if (teamIds.length === 0) return; // unowned workstream

    const content = buildContent(req, opts.event);

    // Deliver on the requested channels; each is best-effort and independent.
    await Promise.allSettled([
      channels.includes("slack")
        ? deliverSlack(admin, teamIds, content.slackText)
        : Promise.resolve(),
      channels.includes("email") && emailConfigured()
        ? deliverEmail(admin, teamIds, opts.actorId, content)
        : Promise.resolve(),
    ]);
  } catch (err) {
    console.error("[notifications] notifyWorkstreamOwners failed", err);
  }
}

/**
 * Email people who were @mentioned in a comment. Best-effort and audience-safe:
 * a recipient is only emailed if they can actually see the request (checked via
 * the can_view_request DB function), so a mention never leaks a private request.
 */
export async function notifyMention(opts: {
  requestId: string;
  actorId: string;
  mentionedUserIds: string[];
}): Promise<void> {
  try {
    if (!emailConfigured()) return;
    if (opts.mentionedUserIds.length === 0) return;
    const admin = createAdminClient();

    const { data: req } = await admin
      .from("requests")
      .select("id, title, product:products(name)")
      .eq("id", opts.requestId)
      .maybeSingle<{
        id: string;
        title: string | null;
        product: { name: string } | null;
      }>();
    if (!req) return;

    const { data: actor } = await admin
      .from("profiles")
      .select("full_name, email")
      .eq("id", opts.actorId)
      .maybeSingle<{ full_name: string | null; email: string | null }>();
    const actorName =
      actor?.full_name ?? actor?.email ?? "Someone";

    const { data: people } = await admin
      .from("profiles")
      .select("id, email, full_name")
      .in("id", opts.mentionedUserIds)
      .returns<{ id: string; email: string | null; full_name: string | null }[]>();

    const base = siteUrl();
    const link = base ? `${base}/requests/${req.id}` : "";
    const title = req.title || "Untitled request";
    const workstream = req.product?.name ?? null;

    await Promise.allSettled(
      (people ?? [])
        .filter((p) => p.id !== opts.actorId && p.email)
        .map(async (p) => {
          // Only email recipients who can actually see the request. The type
          // generator doesn't emit DB functions, so the rpc name is cast.
          const { data: canView } = await admin.rpc(
            "can_view_request" as never,
            { req_id: req.id, uid: p.id } as never
          );
          if (canView !== true) return;
          const content = buildMentionContent({
            actorName,
            title,
            workstream,
            link,
          });
          await sendEmail({
            to: p.email as string,
            subject: content.subject,
            html: content.html,
            text: content.text,
          });
        })
    );
  } catch (err) {
    console.error("[notifications] notifyMention failed", err);
  }
}

function buildMentionContent(opts: {
  actorName: string;
  title: string;
  workstream: string | null;
  link: string;
}): { subject: string; html: string; text: string } {
  const { actorName, title, workstream, link } = opts;
  const subject = `${actorName} mentioned you on "${title}"`;
  const lead = `${actorName} mentioned you in a comment on a Beacon request.`;

  const text = [
    lead,
    "",
    `Request: ${title}`,
    workstream ? `Workstream: ${workstream}` : null,
    link ? `\nView it: ${link}` : null,
    "",
    "— Beacon",
  ]
    .filter((l) => l !== null)
    .join("\n");

  const button = link
    ? `<a href="${link}" style="display:inline-block;margin-top:20px;background:#6d28d9;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600;font-size:14px;">Open request</a>`
    : "";
  const wsRow = workstream
    ? `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;">Workstream</td><td style="padding:4px 0;font-weight:600;">${escapeHtml(
        workstream
      )}</td></tr>`
    : "";

  const html = `<!-- Beacon mention -->
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111827;">
  <div style="font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#6d28d9;">Beacon</div>
  <h1 style="font-size:18px;margin:12px 0 4px;">${escapeHtml(title)}</h1>
  <p style="margin:0 0 16px;color:#374151;font-size:14px;">${escapeHtml(lead)}</p>
  <table style="border-collapse:collapse;font-size:14px;">${wsRow}</table>
  ${button}
  <p style="margin-top:28px;color:#9ca3af;font-size:12px;">You're receiving this because you were mentioned in a comment on Beacon.</p>
</div>`;

  return { subject, html, text };
}

/** Post the alert to each owning team's Slack channel (those with a webhook). */
async function deliverSlack(
  admin: DB,
  teamIds: string[],
  slackText: string
): Promise<void> {
  const { data: hooks, error } = await admin
    .from("team_slack_webhooks")
    .select("team_id, webhook_url")
    .in("team_id", teamIds)
    .returns<{ team_id: string; webhook_url: string }[]>();
  if (error) {
    console.error("[notifications] slack webhook lookup failed", error.message);
    return;
  }
  if (!hooks || hooks.length === 0) return;
  await Promise.allSettled(
    hooks.map((h) => sendSlackMessage(h.webhook_url, slackText))
  );
}

/** Email each owning-team member (deduped, minus the actor). */
async function deliverEmail(
  admin: DB,
  teamIds: string[],
  actorId: string,
  content: { subject: string; html: string; text: string }
): Promise<void> {
  const { data: members, error } = await admin
    .from("profiles")
    .select("id, email, full_name")
    .in("team_id", teamIds)
    .returns<{ id: string; email: string | null; full_name: string | null }[]>();
  if (error) {
    console.error("[notifications] member lookup failed", error.message);
    return;
  }

  const seen = new Set<string>();
  const recipients = (members ?? [])
    .filter((m) => m.id !== actorId && m.email)
    .filter((m) => {
      const key = (m.email as string).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((m) => m.email as string);
  if (recipients.length === 0) return;

  await Promise.allSettled(
    recipients.map((to) =>
      sendEmail({
        to,
        subject: content.subject,
        html: content.html,
        text: content.text,
      })
    )
  );
}

/**
 * Notify the requester + watchers about an update to THEIR request (status
 * change, decline, upcoming deadline). Each recipient gets a Slack DM when a
 * bot token is configured and they have a slack_user_id, otherwise an email.
 * The actor is never notified about their own action. Best-effort.
 */
export async function notifyRequestUpdate(opts: {
  requestId: string;
  actorId: string;
  event: RequestUpdateEvent;
  /** Extra recipients (e.g. owning-team members for a deadline). */
  extraUserIds?: string[];
}): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: req } = await admin
      .from("requests")
      .select("id, title, author_id, product:products(name)")
      .eq("id", opts.requestId)
      .maybeSingle<{
        id: string;
        title: string | null;
        author_id: string;
        product: { name: string } | null;
      }>();
    if (!req) return;

    const { data: watchers } = await admin
      .from("request_watchers")
      .select("user_id")
      .eq("request_id", opts.requestId)
      .returns<{ user_id: string }[]>();

    const userIds = [
      req.author_id,
      ...(watchers ?? []).map((w) => w.user_id),
      ...(opts.extraUserIds ?? []),
    ];
    const content = buildUpdateContent(req, opts.event);
    await deliverToUsers(admin, userIds, opts.actorId, content);
  } catch (err) {
    console.error("[notifications] notifyRequestUpdate failed", err);
  }
}

/**
 * Deliver a message to a set of users, deduped and minus the actor. Prefers a
 * Slack DM (bot token + the user's slack_user_id); falls back to email. Every
 * send is independent and best-effort.
 */
async function deliverToUsers(
  admin: DB,
  userIds: string[],
  actorId: string,
  content: { subject: string; html: string; text: string; slackText: string }
): Promise<void> {
  const unique = [...new Set(userIds)].filter((id) => id && id !== actorId);
  if (unique.length === 0) return;

  const { data: people } = await admin
    .from("profiles")
    .select("id, email, slack_user_id")
    .in("id", unique)
    .returns<
      { id: string; email: string | null; slack_user_id: string | null }[]
    >();
  if (!people || people.length === 0) return;

  const dmOk = slackDmConfigured();
  const canEmail = emailConfigured();

  await Promise.allSettled(
    people.map(async (p) => {
      if (dmOk && p.slack_user_id) {
        const res = await sendSlackDm(p.slack_user_id, content.slackText);
        if (res.sent) return; // delivered via DM; don't double-send
      }
      if (canEmail && p.email) {
        await sendEmail({
          to: p.email,
          subject: content.subject,
          html: content.html,
          text: content.text,
        });
      }
    })
  );
}

function buildUpdateContent(
  req: { id: string; title: string | null; product: { name: string } | null },
  event: RequestUpdateEvent
): { subject: string; html: string; text: string; slackText: string } {
  const title = req.title || "Untitled request";
  const workstream = req.product?.name ?? null;
  const base = siteUrl();
  const link = base ? `${base}/requests/${req.id}` : "";

  let subject: string;
  let lead: string;
  let extra: { label: string; value: string } | null = null;
  if (event.kind === "declined") {
    subject = `Your request "${title}" was declined`;
    lead = `Your request was moved to "${event.statusLabel}".`;
    if (event.reason && event.reason.trim().length > 0) {
      extra = { label: "Reason", value: event.reason.trim() };
    }
  } else if (event.kind === "deadline_soon") {
    subject = `Reminder: "${title}" is due ${event.deadline}`;
    lead = `Your request is due on ${event.deadline}.`;
  } else {
    subject = `Your request "${title}" is now ${event.statusLabel}`;
    lead = `Your request moved to "${event.statusLabel}".`;
  }

  const text = [
    lead,
    "",
    `Request: ${title}`,
    workstream ? `Workstream: ${workstream}` : null,
    extra ? `${extra.label}: ${extra.value}` : null,
    link ? `\nView it: ${link}` : null,
    "",
    "— Beacon",
  ]
    .filter((l) => l !== null)
    .join("\n");

  const slackText = [
    `:bell: *${slackEscape(subject)}*`,
    slackEscape(lead),
    extra ? `*${extra.label}:* ${slackEscape(extra.value)}` : "",
    link ? `<${link}|Open request>` : "",
  ]
    .filter((l) => l.length > 0)
    .join("\n");

  const button = link
    ? `<a href="${link}" style="display:inline-block;margin-top:20px;background:#6d28d9;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600;font-size:14px;">Open request</a>`
    : "";
  const rows = [
    workstream
      ? `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;">Workstream</td><td style="padding:4px 0;font-weight:600;">${escapeHtml(
          workstream
        )}</td></tr>`
      : "",
    extra
      ? `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;">${escapeHtml(
          extra.label
        )}</td><td style="padding:4px 0;">${escapeHtml(extra.value)}</td></tr>`
      : "",
  ].join("");

  const html = `<!-- Beacon request update -->
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111827;">
  <div style="font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#6d28d9;">Beacon</div>
  <h1 style="font-size:18px;margin:12px 0 4px;">${escapeHtml(title)}</h1>
  <p style="margin:0 0 16px;color:#374151;font-size:14px;">${escapeHtml(lead)}</p>
  <table style="border-collapse:collapse;font-size:14px;">${rows}</table>
  ${button}
  <p style="margin-top:28px;color:#9ca3af;font-size:12px;">You're receiving this because you requested or are watching this on Beacon.</p>
</div>`;

  return { subject, html, text, slackText };
}

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
}

function buildContent(
  req: RequestForNotify,
  event: WorkstreamEvent
): { subject: string; html: string; text: string; slackText: string } {
  const workstream = req.product?.name ?? "a workstream";
  const requester = req.team?.name ?? "an unassigned team";
  const title = req.title || "Untitled request";
  const base = siteUrl();
  const link = base ? `${base}/requests/${req.id}` : "";

  let lead: string;
  let subject: string;
  switch (event.kind) {
    case "submitted":
      lead = `A new request was submitted into ${workstream}.`;
      subject = `New request in ${workstream}: ${title}`;
      break;
    case "status_changed":
      lead = `A request in ${workstream} moved to "${event.statusLabel}".`;
      subject = `${workstream} — "${title}" is now ${event.statusLabel}`;
      break;
    case "unacknowledged":
      lead = `A request in ${workstream} has been waiting ${event.days} days with no response. Please triage it.`;
      subject = `Still awaiting triage (${event.days}d): "${title}"`;
      break;
    case "deadline_soon":
      lead = `A request in ${workstream} is due on ${event.deadline}.`;
      subject = `Due ${event.deadline}: "${title}"`;
      break;
  }

  const text = [
    lead,
    "",
    `Request: ${title}`,
    `Workstream: ${workstream}`,
    `Requesting team: ${requester}`,
    event.kind === "status_changed" ? `Status: ${event.statusLabel}` : null,
    event.kind === "deadline_soon" ? `Deadline: ${event.deadline}` : null,
    link ? `\nView it: ${link}` : null,
    "",
    "— Beacon",
  ]
    .filter((l) => l !== null)
    .join("\n");

  // Slack mrkdwn. Escape the dynamic spans; render the link as <url|label>.
  const slackText = [
    `:bell: *${slackEscape(subject)}*`,
    slackEscape(lead),
    `*Workstream:* ${slackEscape(workstream)}  •  *Requesting team:* ${slackEscape(
      requester
    )}` +
      (event.kind === "status_changed"
        ? `  •  *Status:* ${slackEscape(event.statusLabel)}`
        : ""),
    link ? `<${link}|Open request>` : "",
  ]
    .filter((l) => l.length > 0)
    .join("\n");

  const eTitle = escapeHtml(title);
  const eWorkstream = escapeHtml(workstream);
  const eRequester = escapeHtml(requester);
  const eLead = escapeHtml(lead);
  const statusRow =
    event.kind === "status_changed"
      ? `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;">Status</td><td style="padding:4px 0;font-weight:600;">${escapeHtml(
          event.statusLabel
        )}</td></tr>`
      : "";
  const button = link
    ? `<a href="${link}" style="display:inline-block;margin-top:20px;background:#6d28d9;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600;font-size:14px;">Open request</a>`
    : "";

  const html = `<!-- Beacon workstream alert -->
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111827;">
  <div style="font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#6d28d9;">Beacon</div>
  <h1 style="font-size:18px;margin:12px 0 4px;">${eTitle}</h1>
  <p style="margin:0 0 16px;color:#374151;font-size:14px;">${eLead}</p>
  <table style="border-collapse:collapse;font-size:14px;">
    <tr><td style="padding:4px 12px 4px 0;color:#6b7280;">Workstream</td><td style="padding:4px 0;font-weight:600;">${eWorkstream}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#6b7280;">Requesting team</td><td style="padding:4px 0;">${eRequester}</td></tr>
    ${statusRow}
  </table>
  ${button}
  <p style="margin-top:28px;color:#9ca3af;font-size:12px;">You're receiving this because your team owns the ${eWorkstream} workstream in Beacon.</p>
</div>`;

  return { subject, html, text, slackText };
}
