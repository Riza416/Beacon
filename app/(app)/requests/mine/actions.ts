"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authedAction } from "@/lib/actions/utils";

const orderedIdsSchema = z.array(z.string().uuid()).max(1000);

/**
 * Persist a full reorder of the current user's requests. Writes
 * `priority = idx` for each request in `orderedIds` whose `author_id`
 * matches the current user. Any id not owned by the caller is silently
 * skipped (RLS will refuse the update anyway).
 */
export async function reorderMineFull(
  orderedIds: string[]
): Promise<{ ok: true }> {
  const ids = orderedIdsSchema.parse(orderedIds);
  const { supabase, profile } = await authedAction();

  if (ids.length === 0) {
    return { ok: true };
  }

  // Confirm the caller actually owns the ids they're trying to reorder.
  // RLS would block other rows from being updated, but doing an explicit
  // lookup means we don't silently fan out write attempts that will fail.
  const { data: owned, error: ownedErr } = await supabase
    .from("requests")
    .select("id")
    .eq("author_id", profile.id)
    .in("id", ids)
    .returns<{ id: string }[]>();
  if (ownedErr) throw new Error(ownedErr.message);

  const ownedSet = new Set((owned ?? []).map((r) => r.id));

  // Update each request's priority to match its index in the ordered list.
  // We issue one update per row; the list is the user's own requests so
  // bounded in practice. Sequential rather than parallel to keep RLS errors
  // surfaced cleanly.
  for (let idx = 0; idx < ids.length; idx++) {
    const id = ids[idx];
    if (!ownedSet.has(id)) continue;
    const { error } = await supabase
      .from("requests")
      .update({ priority: idx })
      .eq("id", id)
      .eq("author_id", profile.id);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/requests/mine");
  revalidatePath("/");
  return { ok: true };
}
