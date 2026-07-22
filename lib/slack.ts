// Server-only Slack delivery via an incoming webhook.
//
// A single fetch — no SDK, no bot token. The URL is a per-team secret (stored
// in team_slack_webhooks, admin-only RLS) and must never reach the client.
// Never throws: failures are logged and returned as { sent: false } so a
// notification can't break the user action that triggered it.

export interface SendSlackResult {
  sent: boolean;
  error?: string;
}

/** Slack mrkdwn requires &, <, > to be escaped in text spans. */
export function slackEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function sendSlackMessage(
  webhookUrl: string,
  text: string
): Promise<SendSlackResult> {
  if (!webhookUrl) return { sent: false, error: "no_webhook" };
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[slack] post failed (${res.status}): ${body}`);
      return { sent: false, error: `status_${res.status}` };
    }
    return { sent: true };
  } catch (err) {
    console.error("[slack] post threw", err);
    return { sent: false, error: err instanceof Error ? err.message : "unknown" };
  }
}
