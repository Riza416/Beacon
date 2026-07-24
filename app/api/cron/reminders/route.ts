// Daily reminder job (Vercel Cron — see vercel.json).
//
//   • Un-acknowledged requests: if a submitted request has sat for 7+ days
//     still at its default status (no response), nudge the owning team.
//   • Upcoming deadlines: 7 days before a request's deadline, remind the owning
//     team plus the requester and watchers.
//
// Each request is reminded at most once per kind (tracked by unack_reminder_at
// / deadline_reminder_at), so re-running the job is safe.

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  notifyWorkstreamOwners,
  notifyRequestUpdate,
} from "@/lib/notifications";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DAY = 86_400_000;
const MAX_PER_RUN = 200;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  // If no secret is configured, allow (e.g. local). In production set CRON_SECRET
  // — Vercel Cron sends it as `Authorization: Bearer <CRON_SECRET>`.
  if (!secret) return true;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  // Status lookup: which ids are terminal, which is the default.
  const { data: statuses } = await admin
    .from("statuses")
    .select("id, is_terminal, is_default")
    .returns<{ id: string; is_terminal: boolean; is_default: boolean }[]>();
  const terminalIds = new Set(
    (statuses ?? []).filter((s) => s.is_terminal).map((s) => s.id)
  );
  const defaultId = (statuses ?? []).find((s) => s.is_default)?.id ?? null;

  let unackSent = 0;
  let deadlineSent = 0;

  // 1) Un-acknowledged for 7+ days --------------------------------------------
  const unackCutoff = new Date(now - 7 * DAY).toISOString();
  const { data: stale } = await admin
    .from("requests")
    .select("id, product_id, status_id, submitted_at")
    .eq("state", "submitted")
    .not("product_id", "is", null)
    .lte("submitted_at", unackCutoff)
    .is("unack_reminder_at", null)
    .limit(MAX_PER_RUN)
    .returns<
      {
        id: string;
        product_id: string | null;
        status_id: string | null;
        submitted_at: string | null;
      }[]
    >();

  for (const r of stale ?? []) {
    // Still awaiting a first response = no status, or still at the default.
    const awaiting = !r.status_id || r.status_id === defaultId;
    if (!awaiting) continue;
    if (r.status_id && terminalIds.has(r.status_id)) continue;
    const days = r.submitted_at
      ? Math.floor((now - new Date(r.submitted_at).getTime()) / DAY)
      : 7;
    await notifyWorkstreamOwners({
      requestId: r.id,
      actorId: "", // system-initiated: no actor to exclude
      event: { kind: "unacknowledged", days },
      channels: ["slack", "email"],
    });
    await admin
      .from("requests")
      .update({ unack_reminder_at: nowIso })
      .eq("id", r.id);
    unackSent += 1;
  }

  // 2) Deadline within the next 7 days ----------------------------------------
  const today = nowIso.slice(0, 10);
  const in7 = new Date(now + 7 * DAY).toISOString().slice(0, 10);
  const { data: dueSoon } = await admin
    .from("requests")
    .select("id, status_id, deadline")
    .not("deadline", "is", null)
    .gte("deadline", today)
    .lte("deadline", in7)
    .is("deadline_reminder_at", null)
    .limit(MAX_PER_RUN)
    .returns<{ id: string; status_id: string | null; deadline: string | null }[]>();

  for (const r of dueSoon ?? []) {
    if (r.status_id && terminalIds.has(r.status_id)) continue; // done → skip
    const deadline = r.deadline as string;
    await notifyWorkstreamOwners({
      requestId: r.id,
      actorId: "",
      event: { kind: "deadline_soon", deadline },
      channels: ["slack", "email"],
    });
    await notifyRequestUpdate({
      requestId: r.id,
      actorId: "",
      event: { kind: "deadline_soon", deadline },
    });
    await admin
      .from("requests")
      .update({ deadline_reminder_at: nowIso })
      .eq("id", r.id);
    deadlineSent += 1;
  }

  return NextResponse.json({ ok: true, unackSent, deadlineSent });
}
