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
import { sendSlackMessage, slackEscape } from "@/lib/slack";
import type { Database } from "@/lib/database.types";

type DB = SupabaseClient<Database>;

export type WorkstreamEvent =
  | { kind: "submitted" }
  | { kind: "status_changed"; statusLabel: string };

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
}): Promise<void> {
  try {
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

    // Deliver to whatever channels are configured; both are best-effort.
    await Promise.allSettled([
      deliverSlack(admin, teamIds, content.slackText),
      emailConfigured()
        ? deliverEmail(admin, teamIds, opts.actorId, content)
        : Promise.resolve(),
    ]);
  } catch (err) {
    console.error("[notifications] notifyWorkstreamOwners failed", err);
  }
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

  const lead =
    event.kind === "submitted"
      ? `A new request was submitted into ${workstream}.`
      : `A request in ${workstream} moved to "${event.statusLabel}".`;
  const subject =
    event.kind === "submitted"
      ? `New request in ${workstream}: ${title}`
      : `${workstream} — "${title}" is now ${event.statusLabel}`;

  const text = [
    lead,
    "",
    `Request: ${title}`,
    `Workstream: ${workstream}`,
    `Requesting team: ${requester}`,
    event.kind === "status_changed" ? `Status: ${event.statusLabel}` : null,
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
