import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

type DB = SupabaseClient<Database>;

// Priority is scoped to a (team_id, product_id) group. Each group keeps its
// own dense 0..N-1 sequence with no duplicates, so "#1 in Product A" and
// "#1 in Product B" can coexist for the same team. The null-team / null-product
// bucket is a valid group too. All mutation paths funnel through this module so
// the invariant is defined in exactly one place.

function groupQuery(db: DB, teamId: string | null, productId: string | null) {
  let q = db
    .from("requests")
    .select("id, team_priority, updated_at")
    .order("team_priority", { ascending: true })
    .order("updated_at", { ascending: false });
  q = teamId ? q.eq("team_id", teamId) : q.is("team_id", null);
  q = productId ? q.eq("product_id", productId) : q.is("product_id", null);
  return q;
}

type GroupRow = { id: string; team_priority: number; updated_at: string };

/** The next free priority slot (max + 1) in a group — used when inserting. */
export async function nextSlot(
  db: DB,
  teamId: string | null,
  productId: string | null
): Promise<number> {
  const { data, error } = await groupQuery(db, teamId, productId);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as GroupRow[];
  return rows.reduce((max, r) => Math.max(max, r.team_priority), -1) + 1;
}

/** Renumber a group to a dense 0..N-1 sequence in its current order. */
export async function compact(
  db: DB,
  teamId: string | null,
  productId: string | null
): Promise<void> {
  const { data, error } = await groupQuery(db, teamId, productId);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as GroupRow[];
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].team_priority === i) continue;
    const { error: updErr } = await db
      .from("requests")
      .update({ team_priority: i })
      .eq("id", rows[i].id);
    if (updErr) throw new Error(updErr.message);
  }
}

/**
 * Move `requestId` to `targetIndex` within its group, shifting the rest so the
 * result is a dense 0..N-1 sequence with no duplicates.
 */
export async function resequence(
  db: DB,
  teamId: string | null,
  productId: string | null,
  requestId: string,
  targetIndex: number
): Promise<void> {
  const { data, error } = await groupQuery(db, teamId, productId);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as GroupRow[];
  if (rows.length === 0) return;

  const others = rows.filter((r) => r.id !== requestId);
  const target: { id: string; team_priority: number } = rows.find(
    (r) => r.id === requestId
  ) ?? { id: requestId, team_priority: -1 };

  const clamped = Math.max(0, Math.min(targetIndex, others.length));
  const ordered = [...others.slice(0, clamped), target, ...others.slice(clamped)];

  for (let i = 0; i < ordered.length; i++) {
    if (ordered[i].team_priority === i) continue;
    const { error: updErr } = await db
      .from("requests")
      .update({ team_priority: i })
      .eq("id", ordered[i].id);
    if (updErr) throw new Error(updErr.message);
  }
}

// ---------------------------------------------------------------------------
// Workstream priority — the OWNING team's dense 0..N-1 rank of every request
// in a workstream (product_id). Parallel to the team-priority helpers above,
// but scoped to a single product and writing the workstream_priority column.
// A null product has no workstream ranking, so these are no-ops for it.
// ---------------------------------------------------------------------------

function workstreamGroupQuery(db: DB, productId: string) {
  return db
    .from("requests")
    .select("id, workstream_priority, updated_at")
    .eq("product_id", productId)
    .order("workstream_priority", { ascending: true })
    .order("updated_at", { ascending: false });
}

type WsRow = { id: string; workstream_priority: number; updated_at: string };

/** Next free workstream slot (max + 1) in a workstream. */
export async function nextWorkstreamSlot(
  db: DB,
  productId: string | null
): Promise<number> {
  if (!productId) return 0;
  const { data, error } = await workstreamGroupQuery(db, productId);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as WsRow[];
  return rows.reduce((max, r) => Math.max(max, r.workstream_priority), -1) + 1;
}

/** Renumber a workstream to a dense 0..N-1 sequence in its current order. */
export async function compactWorkstream(
  db: DB,
  productId: string | null
): Promise<void> {
  if (!productId) return;
  const { data, error } = await workstreamGroupQuery(db, productId);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as WsRow[];
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].workstream_priority === i) continue;
    const { error: updErr } = await db
      .from("requests")
      .update({ workstream_priority: i })
      .eq("id", rows[i].id);
    if (updErr) throw new Error(updErr.message);
  }
}

/** Move `requestId` to `targetIndex` within its workstream; dense, no dupes. */
export async function resequenceWorkstream(
  db: DB,
  productId: string | null,
  requestId: string,
  targetIndex: number
): Promise<void> {
  if (!productId) return;
  const { data, error } = await workstreamGroupQuery(db, productId);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as WsRow[];
  if (rows.length === 0) return;

  const others = rows.filter((r) => r.id !== requestId);
  const target: { id: string; workstream_priority: number } = rows.find(
    (r) => r.id === requestId
  ) ?? { id: requestId, workstream_priority: -1 };

  const clamped = Math.max(0, Math.min(targetIndex, others.length));
  const ordered = [...others.slice(0, clamped), target, ...others.slice(clamped)];

  for (let i = 0; i < ordered.length; i++) {
    if (ordered[i].workstream_priority === i) continue;
    const { error: updErr } = await db
      .from("requests")
      .update({ workstream_priority: i })
      .eq("id", ordered[i].id);
    if (updErr) throw new Error(updErr.message);
  }
}
