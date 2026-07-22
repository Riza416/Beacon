// Workstream-owner email alerts.
//
// When a request is submitted into a workstream, or its status changes, the
// members of the team(s) that OWN that workstream get an email. Recipients are
// resolved through the service-role client because the alert crosses team
// boundaries (a submitter on team A triggers mail to owning team B, whose
// profiles RLS would otherwise hide). That's safe here: the function is only
// ever called from an already-authorized mutation, and it only reads the data
// needed to address the mail — it grants the caller nothing.
//
// Every failure is swallowed and logged: a notification must never break the
// underlying create/update the user just performed.

import { createAdminClient } from "@/lib/supabase/admin";
import { emailConfigured, escapeHtml, sendEmail } from "@/lib/email";

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

/**
 * Email the owning team(s) of a request's workstream about an event, excluding
 * whoever triggered it. No-ops (silently) when email isn't configured, when the
 * request has no workstream, or when the workstream has no owning team.
 */
export async function notifyWorkstreamOwners(opts: {
  requestId: string;
  actorId: string;
  event: WorkstreamEvent;
}): Promise<void> {
  try {
    // Skip all DB work if we couldn't send anyway.
    if (!emailConfigured()) return;

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

    const { data: members, error: memErr } = await admin
      .from("profiles")
      .select("id, email, full_name")
      .in("team_id", teamIds)
      .returns<{ id: string; email: string | null; full_name: string | null }[]>();
    if (memErr) throw new Error(memErr.message);

    // Owning-team members, minus the actor, deduped by email.
    const seen = new Set<string>();
    const recipients = (members ?? [])
      .filter((m) => m.id !== opts.actorId && m.email)
      .filter((m) => {
        const key = (m.email as string).toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((m) => ({ email: m.email as string, name: m.full_name }));
    if (recipients.length === 0) return;

    const content = buildContent(req, opts.event);

    const results = await Promise.allSettled(
      recipients.map((r) =>
        sendEmail({
          to: r.email,
          subject: content.subject,
          html: content.html,
          text: content.text,
        })
      )
    );
    const sent = results.filter(
      (r) => r.status === "fulfilled" && r.value.sent
    ).length;
    if (sent < recipients.length) {
      console.warn(
        `[notifications] ${content.subject}: sent ${sent}/${recipients.length}`
      );
    }
  } catch (err) {
    console.error("[notifications] notifyWorkstreamOwners failed", err);
  }
}

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
}

function buildContent(
  req: RequestForNotify,
  event: WorkstreamEvent
): { subject: string; html: string; text: string } {
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

  return { subject, html, text };
}
