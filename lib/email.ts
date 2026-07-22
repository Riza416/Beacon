// Server-only transactional email via Resend's REST API.
//
// A single fetch keeps the supply-chain surface minimal (no SDK dependency).
// The sender no-ops when RESEND_API_KEY / EMAIL_FROM aren't configured, so the
// app runs fine locally and before the sending domain is verified — callers
// get { sent: false } rather than an exception. This module must never be
// imported into client code: it reads a secret env var (RESEND_API_KEY) that
// must stay server-side.

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export interface SendEmailArgs {
  /** A single recipient. Send one message per person so nobody sees the list. */
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface SendEmailResult {
  sent: boolean;
  error?: string;
}

/** True when both the API key and a From address are present. */
export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

/**
 * Send one transactional email. Never throws — every failure is logged and
 * returned as { sent: false }, so notification code can fire it without
 * risking the user's underlying action.
 */
export async function sendEmail(args: SendEmailArgs): Promise<SendEmailResult> {
  const to = args.to.trim();
  if (!to) return { sent: false, error: "no_recipient" };

  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) {
    console.warn(
      `[email] RESEND_API_KEY / EMAIL_FROM not set — skipping "${args.subject}"`
    );
    return { sent: false, error: "not_configured" };
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: args.subject,
        html: args.html,
        text: args.text,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[email] send failed (${res.status}): ${body}`);
      return { sent: false, error: `status_${res.status}` };
    }
    return { sent: true };
  } catch (err) {
    console.error("[email] send threw", err);
    return { sent: false, error: err instanceof Error ? err.message : "unknown" };
  }
}

/** Escape user-provided text before interpolating into an HTML email body. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
