"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { emailConfigured, escapeHtml, sendEmail } from "@/lib/email";

/**
 * Sign-up that skips Supabase's email-verification step. Creates the user
 * via the admin endpoint with `email_confirm: true` so they can immediately
 * sign in with the password. The client follows this call with a regular
 * signInWithPassword to establish the session.
 *
 * Uses the service-role key, so it runs server-side only.
 */
export async function signUpAndConfirm(
  email: string,
  password: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmedEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    return { ok: false, error: "Invalid email" };
  }
  if (password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters" };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return { ok: false, error: "Server not configured" };
  }

  const res = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: trimmedEmail,
      password,
      email_confirm: true,
    }),
  });

  if (res.ok) {
    // New accounts sit behind global-admin approval (see 0032). Give the
    // admins a heads-up so sign-ups don't sit unnoticed. Best-effort.
    await notifyAdminsOfSignup(trimmedEmail).catch(() => {});
    return { ok: true };
  }

  // Try to parse a useful error message out of the response body.
  let message = `Sign-up failed (${res.status})`;
  try {
    const body = await res.json();
    if (typeof body?.msg === "string") message = body.msg;
    else if (typeof body?.message === "string") message = body.message;
    else if (typeof body?.error_description === "string")
      message = body.error_description;
  } catch {
    // ignore
  }
  return { ok: false, error: message };
}

/** Email every global admin that a new account is awaiting approval. */
async function notifyAdminsOfSignup(newEmail: string): Promise<void> {
  if (!emailConfigured()) return;
  const admin = createAdminClient();
  const { data: admins } = await admin
    .from("profiles")
    .select("email")
    .eq("role", "admin")
    .returns<{ email: string | null }[]>();
  const recipients = (admins ?? [])
    .map((a) => a.email)
    .filter((e): e is string => Boolean(e));
  if (recipients.length === 0) return;

  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  const link = base ? `${base}/admin/teams` : "";
  const text = [
    `A new Beacon account is awaiting approval: ${newEmail}`,
    "",
    "They can't see anything until you approve them.",
    link ? `Approve or reject: ${link}` : null,
    "",
    "— Beacon",
  ]
    .filter((l) => l !== null)
    .join("\n");

  await Promise.allSettled(
    recipients.map((to) =>
      sendEmail({
        to,
        subject: `Beacon sign-up awaiting approval: ${newEmail}`,
        html: `<p>A new Beacon account is awaiting approval: <strong>${escapeHtml(
          newEmail
        )}</strong></p><p>They can't see anything until you approve them.</p>${
          link ? `<p><a href="${link}">Approve or reject</a></p>` : ""
        }`,
        text,
      })
    )
  );
}
