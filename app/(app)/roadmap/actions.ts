"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authedAction } from "@/lib/actions/utils";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseDay } from "@/lib/roadmap";

const uuidSchema = z.string().uuid();
const daySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Dates must be YYYY-MM-DD")
  .refine((s) => parseDay(s) !== null, "Not a real date")
  .nullable();

/**
 * Set (or clear) a request's planned delivery span — the bar on the roadmap.
 *
 * Who: a global admin, or a member of a team that owns the request's
 * workstream. Same rule as setRequestOwner — the plan is the owning team's
 * commitment, not the requester's. The requester's own "needed by" date is
 * `deadline` and is untouched here.
 */
export async function setRequestSchedule(
  requestId: string,
  startDate: string | null,
  targetDate: string | null
): Promise<{ ok: true }> {
  const reqId = uuidSchema.parse(requestId);
  const start = daySchema.parse(startDate);
  const target = daySchema.parse(targetDate);
  if (start && target && start > target) {
    throw new Error("The start date must be on or before the target date.");
  }

  const { supabase, profile } = await authedAction();

  // Read through the caller's own client so RLS decides whether they can even
  // see this request (private requests stay private).
  const { data: req, error: reqErr } = await supabase
    .from("requests")
    .select("id, product_id, start_date, target_date")
    .eq("id", reqId)
    .maybeSingle<{
      id: string;
      product_id: string | null;
      start_date: string | null;
      target_date: string | null;
    }>();
  if (reqErr) throw new Error(reqErr.message);
  if (!req) throw new Error("Request not found");

  if (profile.role !== "admin") {
    if (!req.product_id) {
      throw new Error("Assign this request to a workstream before scheduling it.");
    }
    const { data: ownerTeams } = await supabase
      .from("product_owners")
      .select("team_id")
      .eq("product_id", req.product_id)
      .returns<{ team_id: string }[]>();
    const owning = new Set((ownerTeams ?? []).map((o) => o.team_id));
    if (!profile.team_id || !owning.has(profile.team_id)) {
      throw new Error("Only the owning team can schedule this request.");
    }
  }

  // No-op guard: a drag that snaps back to where it started writes nothing and
  // logs nothing.
  if (req.start_date === start && req.target_date === target) {
    return { ok: true };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("requests")
    .update({ start_date: start, target_date: target })
    .eq("id", reqId);
  if (error) throw new Error(error.message);

  await admin.from("request_events").insert({
    request_id: reqId,
    actor_id: profile.id,
    kind: "scheduled",
    note:
      start || target
        ? `${start ?? "?"} → ${target ?? "?"}`
        : "cleared",
  });

  revalidatePath("/roadmap");
  revalidatePath(`/requests/${reqId}`);
  return { ok: true };
}
