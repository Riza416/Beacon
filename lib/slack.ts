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

/** True when a workspace bot token is configured (needed to send DMs). */
export function slackDmConfigured(): boolean {
  return Boolean(process.env.SLACK_BOT_TOKEN);
}

/**
 * DM a Slack user via chat.postMessage. Requires SLACK_BOT_TOKEN (a bot token
 * with chat:write) and the recipient's Slack member id. Incoming webhooks can't
 * DM, so this is the one place we use the Web API. Never throws.
 */
export async function sendSlackDm(
  slackUserId: string,
  text: string
): Promise<SendSlackResult> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return { sent: false, error: "no_bot_token" };
  if (!slackUserId) return { sent: false, error: "no_user_id" };
  try {
    const res = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${token}`,
      },
      // Passing a user id as `channel` opens (or reuses) the DM with them.
      body: JSON.stringify({ channel: slackUserId, text }),
    });
    const body = (await res.json().catch(() => null)) as
      | { ok?: boolean; error?: string }
      | null;
    if (!res.ok || !body?.ok) {
      const err = body?.error ?? `status_${res.status}`;
      console.error(`[slack] dm failed: ${err}`);
      return { sent: false, error: err };
    }
    return { sent: true };
  } catch (err) {
    console.error("[slack] dm threw", err);
    return { sent: false, error: err instanceof Error ? err.message : "unknown" };
  }
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
