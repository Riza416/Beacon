"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { authedAction, adminAction } from "@/lib/actions/utils";
import type {
  FieldDefinition,
  FieldType,
  FieldValue,
  RequestRow,
} from "@/lib/types";
import type { SubmitResult } from "@/lib/request-actions-types";

const VALID_FIELD_TYPES: FieldType[] = [
  "short_text",
  "long_text",
  "url",
  "file",
  "image",
  "select",
  "multi_select",
  "checkbox",
];

function isFieldType(s: string): s is FieldType {
  return (VALID_FIELD_TYPES as string[]).includes(s);
}

function allowedTypes(f: FieldDefinition): FieldType[] {
  return f.field_types && f.field_types.length > 0
    ? f.field_types
    : [f.field_type];
}

/**
 * Form state keys are now `${field_id}::${type}`. Returns null if the key is
 * malformed or the type is unknown.
 */
function parseValueKey(
  key: string
): { fieldId: string; type: FieldType } | null {
  const idx = key.indexOf("::");
  if (idx < 0) return null;
  const fieldId = key.slice(0, idx);
  const type = key.slice(idx + 2);
  if (!fieldId || !isFieldType(type)) return null;
  return { fieldId, type };
}

type FormValues = Record<string, string | boolean>;

interface FormState {
  title: string;
  summary: string;
  productId: string | null;
  values: FormValues;
}

const notionUrlSchema = z
  .string()
  .trim()
  .url()
  .refine(
    (url) => {
      try {
        const u = new URL(url);
        if (u.protocol !== "https:") return false;
        const host = u.hostname.toLowerCase();
        return (
          host === "notion.so" ||
          host.endsWith(".notion.so") ||
          host === "notion.site" ||
          host.endsWith(".notion.site")
        );
      } catch {
        return false;
      }
    },
    { message: "URL must be on notion.so or notion.site" }
  );

const commentSchema = z.object({
  body: z.string().trim().min(1, "Comment cannot be empty").max(10000),
});

const formStateSchema = z.object({
  title: z.string().max(500),
  summary: z.string().max(20000),
  productId: z.string().uuid().nullable(),
  values: z.record(z.string(), z.union([z.string(), z.boolean()])),
});

async function assertEditable(
  requestId: string,
  ctx: Awaited<ReturnType<typeof authedAction>>
): Promise<RequestRow> {
  const { supabase, profile } = ctx;
  const { data, error } = await supabase
    .from("requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle<RequestRow>();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Request not found");
  const isAdmin = profile.role === "admin";
  const isAuthor = data.author_id === profile.id;
  // Authors can edit their own requests in any state (draft or submitted).
  // Admins can edit anything. Everyone else is read-only.
  if (!isAdmin && !isAuthor) {
    throw new Error("You can't edit this request.");
  }
  return data;
}

export async function createDraft(): Promise<void> {
  const { supabase, profile } = await authedAction();

  const { data: defaultStatus } = await supabase
    .from("statuses")
    .select("id")
    .eq("is_default", true)
    .maybeSingle<{ id: string }>();

  // Find the next priority slot for this user's list and for the team list
  // so the new draft appears at the bottom rather than colliding with every
  // other draft at priority=0.
  const { data: mineMax } = await supabase
    .from("requests")
    .select("priority")
    .eq("author_id", profile.id)
    .order("priority", { ascending: false })
    .limit(1)
    .maybeSingle<{ priority: number }>();
  const nextPriority = (mineMax?.priority ?? -1) + 1;

  // Priority is per-team. Find max(team_priority) in the author's team so
  // the new draft slots at the end of that team's dense sequence.
  let nextTeamPriority = 0;
  if (profile.team_id) {
    const { data: teamMax } = await supabase
      .from("requests")
      .select("team_priority")
      .eq("team_id", profile.team_id)
      .order("team_priority", { ascending: false })
      .limit(1)
      .maybeSingle<{ team_priority: number }>();
    nextTeamPriority = (teamMax?.team_priority ?? -1) + 1;
  }

  const { data: inserted, error } = await supabase
    .from("requests")
    .insert({
      title: "Untitled draft",
      author_id: profile.id,
      // Inherit the author's team so the dashboard groups it under the right
      // team instead of "Unassigned". Author can have null team_id (e.g. an
      // admin without a team) — that's allowed; it falls into Unassigned.
      team_id: profile.team_id,
      state: "draft",
      status_id: defaultStatus?.id ?? null,
      priority: nextPriority,
      team_priority: nextTeamPriority,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !inserted) {
    throw new Error(error?.message ?? "Could not create draft");
  }

  // No revalidatePath: this runs during the /requests/new page render which
  // disallows it, and the destination (/edit) and list pages (/requests/mine, /)
  // are all dynamic — they re-fetch on next navigation anyway.
  redirect(`/requests/${inserted.id}/edit`);
}

async function persistFormState(
  requestId: string,
  state: FormState,
  ctx: Awaited<ReturnType<typeof authedAction>>
): Promise<void> {
  const parsed = formStateSchema.parse(state);
  const { supabase } = ctx;

  const title = parsed.title.trim() || "Untitled draft";
  const summary = parsed.summary.trim();

  // Priority is per-team — product changes don't affect priority semantics,
  // so this is a plain field update.
  const { error: reqErr } = await supabase
    .from("requests")
    .update({
      title,
      summary: summary.length === 0 ? null : summary,
      product_id: parsed.productId,
    })
    .eq("id", requestId);
  if (reqErr) throw new Error(reqErr.message);

  // Load active field definitions to know how to interpret values
  const { data: fields, error: fdErr } = await supabase
    .from("request_field_definitions")
    .select("*")
    .eq("is_active", true)
    .returns<FieldDefinition[]>();
  if (fdErr) throw new Error(fdErr.message);

  if (!fields || fields.length === 0) return;

  // Index field defs by id and capture the set of currently-allowed types per
  // field. Anything submitted for a type not in this set is dropped (the form
  // shouldn't be sending it anyway).
  const allowedByField = new Map<string, Set<FieldType>>();
  for (const f of fields) {
    allowedByField.set(f.id, new Set(allowedTypes(f)));
  }

  const rows: {
    request_id: string;
    field_definition_id: string;
    field_type: FieldType;
    value_text: string | null;
  }[] = [];

  for (const [key, raw] of Object.entries(parsed.values)) {
    const parsedKey = parseValueKey(key);
    if (!parsedKey) continue;
    const { fieldId, type } = parsedKey;
    const allowed = allowedByField.get(fieldId);
    if (!allowed || !allowed.has(type)) continue;

    // File / image: ignore here — file_path is updated via setFieldFile.
    if (type === "file" || type === "image") continue;

    let value_text: string | null = null;
    if (type === "checkbox") {
      value_text = raw === true || raw === "true" ? "true" : "false";
    } else if (typeof raw === "string") {
      const trimmed = raw.trim();
      value_text = trimmed.length === 0 ? null : trimmed;
    }

    rows.push({
      request_id: requestId,
      field_definition_id: fieldId,
      field_type: type,
      value_text,
    });
  }

  if (rows.length > 0) {
    const { error: upErr } = await supabase
      .from("request_field_values")
      .upsert(rows, {
        onConflict: "request_id,field_definition_id,field_type",
      });
    if (upErr) throw new Error(upErr.message);
  }
}

export async function saveDraft(
  requestId: string,
  state: FormState
): Promise<{ ok: true }> {
  const ctx = await authedAction();
  await assertEditable(requestId, ctx);
  await persistFormState(requestId, state, ctx);
  revalidatePath(`/requests/${requestId}/edit`);
  revalidatePath(`/requests/${requestId}`);
  revalidatePath("/requests/mine");
  return { ok: true };
}

export async function submitRequest(
  requestId: string,
  state: FormState | null,
  opts: { force?: boolean } = {}
): Promise<SubmitResult> {
  const ctx = await authedAction();
  const req = await assertEditable(requestId, ctx);

  if (req.state !== "draft") {
    // Already submitted — nothing to do.
    return { ok: true };
  }

  // Hard gate: you cannot submit a request unless you belong to a team.
  // Admins are also expected to be on a team (so the request shows up under
  // a team on the dashboard rather than Unassigned). If they're not, point
  // them at /admin/teams.
  if (!ctx.profile.team_id) {
    throw new Error(
      "You need to be on a team before submitting. Ask an admin to add you (Admins: assign yourself under /admin/teams)."
    );
  }

  // Save first so we validate against the freshest state (when called from
  // the edit form). When the user submits from the detail page they have no
  // pending form state, so skip the save and validate what's persisted.
  if (state) {
    await persistFormState(requestId, state, ctx);
  }

  const { supabase } = ctx;
  const { data: fields, error: fdErr } = await supabase
    .from("request_field_definitions")
    .select("*")
    .eq("is_active", true)
    .returns<FieldDefinition[]>();
  if (fdErr) throw new Error(fdErr.message);

  const { data: values, error: fvErr } = await supabase
    .from("request_field_values")
    .select("*")
    .eq("request_id", requestId)
    .returns<FieldValue[]>();
  if (fvErr) throw new Error(fvErr.message);

  // Index by (field_id, type) — one row per type the admin enabled.
  const byFieldType = new Map<string, FieldValue>();
  for (const v of values ?? []) {
    byFieldType.set(`${v.field_definition_id}::${v.field_type}`, v);
  }

  function isFilledForType(type: FieldType, v: FieldValue | undefined): boolean {
    if (!v) return false;
    if (type === "file" || type === "image") {
      return Boolean(v.file_path && v.file_path.length > 0);
    }
    if (type === "checkbox") {
      // Checkbox "required" means it must be checked.
      return v.value_text === "true";
    }
    if (type === "multi_select") {
      // Multi-select is filled if at least one option is selected.
      if (!v.value_text) return false;
      try {
        const arr = JSON.parse(v.value_text);
        return Array.isArray(arr) && arr.length > 0;
      } catch {
        return false;
      }
    }
    return Boolean(v.value_text && v.value_text.trim().length > 0);
  }

  function isFilled(f: FieldDefinition): boolean {
    // A field with multiple allowed types counts as filled as soon as ANY
    // of its sub-inputs has a value. The user picks whichever way they want
    // to provide the answer (screenshot OR file OR url, etc.).
    for (const type of allowedTypes(f)) {
      const v = byFieldType.get(`${f.id}::${type}`);
      if (isFilledForType(type, v)) return true;
    }
    return false;
  }

  const hardMissing = (fields ?? [])
    .filter((f) => f.required_level === "hard" && !isFilled(f))
    .map((f) => ({ id: f.id, label: f.label }));

  if (hardMissing.length > 0) {
    return { ok: false, kind: "hard", missing: hardMissing };
  }

  const softMissing = (fields ?? [])
    .filter((f) => f.required_level === "soft" && !isFilled(f))
    .map((f) => ({ id: f.id, label: f.label }));

  if (softMissing.length > 0 && !opts.force) {
    return { ok: false, kind: "soft", missing: softMissing };
  }

  const { error: updErr } = await supabase
    .from("requests")
    .update({ state: "submitted", submitted_at: new Date().toISOString() })
    .eq("id", requestId);
  if (updErr) throw new Error(updErr.message);

  revalidatePath(`/requests/${requestId}`);
  revalidatePath(`/requests/${requestId}/edit`);
  revalidatePath("/requests/mine");
  revalidatePath("/");
  return { ok: true };
}

export async function setFieldFile(
  requestId: string,
  fieldId: string,
  fieldType: FieldType,
  filePath: string | null
): Promise<{ ok: true }> {
  if (!isFieldType(fieldType)) {
    throw new Error("Invalid field type");
  }
  const ctx = await authedAction();
  await assertEditable(requestId, ctx);
  const { supabase } = ctx;

  const { error } = await supabase
    .from("request_field_values")
    .upsert(
      {
        request_id: requestId,
        field_definition_id: fieldId,
        field_type: fieldType,
        file_path: filePath,
      },
      { onConflict: "request_id,field_definition_id,field_type" }
    );
  if (error) throw new Error(error.message);

  revalidatePath(`/requests/${requestId}/edit`);
  revalidatePath(`/requests/${requestId}`);
  return { ok: true };
}

export async function addComment(
  requestId: string,
  body: string
): Promise<{ ok: true }> {
  const { supabase, profile } = await authedAction();
  const parsed = commentSchema.parse({ body });

  // Make sure the request exists and is visible.
  const { data: req, error: reqErr } = await supabase
    .from("requests")
    .select("id")
    .eq("id", requestId)
    .maybeSingle<{ id: string }>();
  if (reqErr) throw new Error(reqErr.message);
  if (!req) throw new Error("Request not found");

  const { error } = await supabase.from("comments").insert({
    request_id: requestId,
    author_id: profile.id,
    body: parsed.body,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/requests/${requestId}`);
  return { ok: true };
}

export async function updateRequestStatus(
  requestId: string,
  statusId: string
): Promise<{ ok: true }> {
  const { supabase } = await adminAction();
  const { error } = await supabase
    .from("requests")
    .update({ status_id: statusId })
    .eq("id", requestId);
  if (error) throw new Error(error.message);

  revalidatePath(`/requests/${requestId}`);
  revalidatePath("/");
  return { ok: true };
}

export async function updateNotionUrl(
  requestId: string,
  url: string
): Promise<{ ok: true }> {
  const { supabase, profile } = await authedAction();

  // Author or admin can set/clear the Notion link. Tightens via a server-side
  // check rather than RLS since the request row already enforces who can update
  // the title/summary (author-while-draft or admin); we relax that for this
  // single column.
  const { data: req, error: reqErr } = await supabase
    .from("requests")
    .select("author_id")
    .eq("id", requestId)
    .maybeSingle<{ author_id: string }>();
  if (reqErr) throw new Error(reqErr.message);
  if (!req) throw new Error("Request not found");

  const isAdmin = profile.role === "admin";
  const isAuthor = req.author_id === profile.id;
  if (!isAdmin && !isAuthor) {
    throw new Error("Only the author or an admin can edit the Notion link.");
  }

  const trimmed = url.trim();
  if (trimmed.length === 0) {
    const { error } = await supabase
      .from("requests")
      .update({ notion_url: null })
      .eq("id", requestId);
    if (error) throw new Error(error.message);
  } else {
    const parsed = notionUrlSchema.safeParse(trimmed);
    if (!parsed.success) {
      throw new Error("Notion URL must be on notion.so or notion.site");
    }
    const { error } = await supabase
      .from("requests")
      .update({ notion_url: parsed.data })
      .eq("id", requestId);
    if (error) throw new Error(error.message);
  }
  revalidatePath(`/requests/${requestId}`);
  revalidatePath("/");
  return { ok: true };
}

export async function deleteRequest(requestId: string): Promise<void> {
  const { supabase } = await adminAction();

  // Capture the team before deletion so we can compact its priorities
  // after the gap appears.
  const { data: doomed } = await supabase
    .from("requests")
    .select("team_id")
    .eq("id", requestId)
    .maybeSingle<{ team_id: string | null }>();

  const { error } = await supabase.from("requests").delete().eq("id", requestId);
  if (error) throw new Error(error.message);

  if (doomed?.team_id) {
    await compactTeamPriorities(supabase, doomed.team_id);
  }

  revalidatePath("/");
  revalidatePath("/requests/mine");
  redirect("/");
}

export async function reorderMine(
  requestId: string,
  direction: "up" | "down"
): Promise<{ ok: true }> {
  const { supabase, profile } = await authedAction();

  const { data: mine, error } = await supabase
    .from("requests")
    .select("id, priority, updated_at")
    .eq("author_id", profile.id)
    .order("priority", { ascending: true })
    .order("updated_at", { ascending: false })
    .returns<{ id: string; priority: number; updated_at: string }[]>();

  if (error) throw new Error(error.message);
  if (!mine) return { ok: true };

  const idx = mine.findIndex((r) => r.id === requestId);
  if (idx < 0) throw new Error("Request not found");

  const neighborIdx = direction === "up" ? idx - 1 : idx + 1;
  if (neighborIdx < 0 || neighborIdx >= mine.length) return { ok: true };

  const current = mine[idx];
  const neighbor = mine[neighborIdx];

  // Swap priorities. If they are equal, bump current's priority appropriately
  // so the order visibly changes.
  let currentNew = neighbor.priority;
  let neighborNew = current.priority;
  if (current.priority === neighbor.priority) {
    if (direction === "up") {
      currentNew = neighbor.priority - 1;
      neighborNew = neighbor.priority;
    } else {
      currentNew = neighbor.priority + 1;
      neighborNew = neighbor.priority;
    }
  }

  const { error: e1 } = await supabase
    .from("requests")
    .update({ priority: currentNew })
    .eq("id", current.id);
  if (e1) throw new Error(e1.message);

  const { error: e2 } = await supabase
    .from("requests")
    .update({ priority: neighborNew })
    .eq("id", neighbor.id);
  if (e2) throw new Error(e2.message);

  revalidatePath("/requests/mine");
  revalidatePath("/");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Tagging: who is asked for feedback on a request.
// User tags live in request_collaborators, team tags in request_team_tags.
// Only the request author or an admin may mutate; everyone authenticated can
// read. View state is tracked in request_collaborators.viewed_at (per-user)
// and request_team_tag_views (per-(user, team-tag) pair).
// ---------------------------------------------------------------------------

const uuidSchema = z.string().uuid();

async function assertCanTag(
  requestId: string,
  ctx: Awaited<ReturnType<typeof authedAction>>
): Promise<void> {
  const { supabase, profile } = ctx;
  if (profile.role === "admin") return;
  const { data, error } = await supabase
    .from("requests")
    .select("author_id")
    .eq("id", requestId)
    .maybeSingle<{ author_id: string }>();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Request not found");
  if (data.author_id !== profile.id) {
    throw new Error("Only the author or an admin can change tags.");
  }
}

function revalidateTagPaths(requestId: string) {
  revalidatePath(`/requests/${requestId}`);
  revalidatePath("/");
  revalidatePath("/requests/tagged-for-me");
}

export async function addUserTag(
  requestId: string,
  userId: string
): Promise<{ ok: true }> {
  const reqId = uuidSchema.parse(requestId);
  const uId = uuidSchema.parse(userId);
  const ctx = await authedAction();
  await assertCanTag(reqId, ctx);

  // upsert-style insert: if the tag already exists we silently succeed so the
  // UI is idempotent.
  const { error } = await ctx.supabase
    .from("request_collaborators")
    .upsert(
      { request_id: reqId, user_id: uId },
      { onConflict: "request_id,user_id", ignoreDuplicates: true }
    );
  if (error) throw new Error(error.message);

  revalidateTagPaths(reqId);
  return { ok: true };
}

export async function removeUserTag(
  requestId: string,
  userId: string
): Promise<{ ok: true }> {
  const reqId = uuidSchema.parse(requestId);
  const uId = uuidSchema.parse(userId);
  const ctx = await authedAction();
  await assertCanTag(reqId, ctx);

  const { error } = await ctx.supabase
    .from("request_collaborators")
    .delete()
    .eq("request_id", reqId)
    .eq("user_id", uId);
  if (error) throw new Error(error.message);

  revalidateTagPaths(reqId);
  return { ok: true };
}

export async function addTeamTag(
  requestId: string,
  teamId: string
): Promise<{ ok: true }> {
  const reqId = uuidSchema.parse(requestId);
  const tId = uuidSchema.parse(teamId);
  const ctx = await authedAction();
  await assertCanTag(reqId, ctx);

  const { error } = await ctx.supabase
    .from("request_team_tags")
    .upsert(
      { request_id: reqId, team_id: tId },
      { onConflict: "request_id,team_id", ignoreDuplicates: true }
    );
  if (error) throw new Error(error.message);

  revalidateTagPaths(reqId);
  return { ok: true };
}

export async function removeTeamTag(
  requestId: string,
  teamId: string
): Promise<{ ok: true }> {
  const reqId = uuidSchema.parse(requestId);
  const tId = uuidSchema.parse(teamId);
  const ctx = await authedAction();
  await assertCanTag(reqId, ctx);

  const { error } = await ctx.supabase
    .from("request_team_tags")
    .delete()
    .eq("request_id", reqId)
    .eq("team_id", tId);
  if (error) throw new Error(error.message);

  revalidateTagPaths(reqId);
  return { ok: true };
}

/**
 * Clear the caller's unread state for any tags pointing at this request.
 *
 * - For user tags: stamp viewed_at on the row where user_id = me.
 * - For team tags on my team: insert a request_team_tag_views row (if missing).
 *
 * Safe to call on every visit — both paths are no-ops when there's nothing to
 * mark.
 */
export async function markTagsViewed(
  requestId: string
): Promise<{ ok: true }> {
  const reqId = uuidSchema.parse(requestId);
  const { supabase, profile } = await authedAction();

  // 1) user tag: stamp viewed_at if not already set.
  const { error: ucErr } = await supabase
    .from("request_collaborators")
    .update({ viewed_at: new Date().toISOString() })
    .eq("request_id", reqId)
    .eq("user_id", profile.id)
    .is("viewed_at", null);
  if (ucErr) throw new Error(ucErr.message);

  // 2) team tag: insert a view row for each tag on my team that I haven't
  // viewed yet. We resolve the matching team tags first, then upsert with
  // ignoreDuplicates so existing views are kept untouched.
  if (profile.team_id) {
    const { data: teamTags, error: ttErr } = await supabase
      .from("request_team_tags")
      .select("team_id")
      .eq("request_id", reqId)
      .eq("team_id", profile.team_id)
      .returns<{ team_id: string }[]>();
    if (ttErr) throw new Error(ttErr.message);

    if (teamTags && teamTags.length > 0) {
      const rows = teamTags.map((t) => ({
        request_id: reqId,
        team_id: t.team_id,
        user_id: profile.id,
      }));
      const { error: vErr } = await supabase
        .from("request_team_tag_views")
        .upsert(rows, {
          onConflict: "request_id,team_id,user_id",
          ignoreDuplicates: true,
        });
      if (vErr) throw new Error(vErr.message);
    }
  }

  // Don't revalidate /requests/[id] — we're already rendering it.
  revalidatePath("/");
  revalidatePath("/requests/tagged-for-me");
  return { ok: true };
}

/**
 * Renumber every request in a team so priorities form a dense 0..N-1
 * sequence by their current order. Used after delete (gap) and as a sanity
 * compactor anywhere the invariant might have drifted. No-op for null-team.
 */
/**
 * Renumber every request in a team so priorities form a dense 0..N-1
 * sequence by their current order. Used after delete (gap) and as a sanity
 * compactor anywhere the invariant might have drifted. No-op for null-team
 * — those requests are a catch-all and don't share an ordering invariant.
 */
async function compactTeamPriorities(
  supabase: Awaited<ReturnType<typeof adminAction>>["supabase"],
  teamId: string | null
): Promise<void> {
  if (!teamId) return;
  const { data: rows, error } = await supabase
    .from("requests")
    .select("id, team_priority, updated_at")
    .eq("team_id", teamId)
    .order("team_priority", { ascending: true })
    .order("updated_at", { ascending: false })
    .returns<{ id: string; team_priority: number; updated_at: string }[]>();
  if (error) throw new Error(error.message);
  if (!rows) return;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].team_priority === i) continue;
    const { error: updErr } = await supabase
      .from("requests")
      .update({ team_priority: i })
      .eq("id", rows[i].id);
    if (updErr) throw new Error(updErr.message);
  }
}

/**
 * Resequence every request in the team so that the target request lands at
 * `targetIndex`. Priorities become a dense 0..N-1 sequence with no
 * duplicates. Other rows shift up or down to make room. For null-team we
 * just write the value verbatim (no group invariant to maintain).
 */
async function resequenceTeamPriorities(
  supabase: Awaited<ReturnType<typeof adminAction>>["supabase"],
  teamId: string | null,
  requestId: string,
  targetIndex: number
): Promise<void> {
  if (!teamId) {
    const { error } = await supabase
      .from("requests")
      .update({ team_priority: Math.max(0, targetIndex) })
      .eq("id", requestId);
    if (error) throw new Error(error.message);
    return;
  }
  const { data: rows, error: listErr } = await supabase
    .from("requests")
    .select("id, team_priority, updated_at")
    .eq("team_id", teamId)
    .order("team_priority", { ascending: true })
    .order("updated_at", { ascending: false })
    .returns<{ id: string; team_priority: number; updated_at: string }[]>();
  if (listErr) throw new Error(listErr.message);
  if (!rows || rows.length === 0) return;

  const others = rows.filter((r) => r.id !== requestId);
  const targetRow =
    rows.find((r) => r.id === requestId) ??
    ({ id: requestId, team_priority: -1, updated_at: "" } as const);

  const clamped = Math.max(0, Math.min(targetIndex, others.length));
  const ordered: { id: string; team_priority: number }[] = [
    ...others.slice(0, clamped),
    targetRow,
    ...others.slice(clamped),
  ];

  // Bulk-write the new priorities. To avoid the (unlikely) intermediate
  // unique-value collision we don't have a unique constraint, so a plain
  // sequence of updates is fine.
  for (let i = 0; i < ordered.length; i++) {
    if (ordered[i].team_priority === i) continue; // already correct
    const { error: updErr } = await supabase
      .from("requests")
      .update({ team_priority: i })
      .eq("id", ordered[i].id);
    if (updErr) throw new Error(updErr.message);
  }
}

export async function setTeamPriority(
  requestId: string,
  value: number
): Promise<{ ok: true }> {
  const { supabase } = await adminAction();
  if (!Number.isFinite(value) || value < 0 || value > 1_000_000) {
    throw new Error("Priority must be a positive number");
  }

  const { data: current, error: curErr } = await supabase
    .from("requests")
    .select("id, team_id")
    .eq("id", requestId)
    .maybeSingle<{ id: string; team_id: string | null }>();
  if (curErr) throw new Error(curErr.message);
  if (!current) throw new Error("Request not found");

  await resequenceTeamPriorities(
    supabase,
    current.team_id,
    requestId,
    Math.round(value)
  );

  revalidatePath("/");
  return { ok: true };
}

export async function reorderTeamPriority(
  requestId: string,
  direction: "up" | "down"
): Promise<{ ok: true }> {
  const { supabase } = await adminAction();

  // Priority is scoped to the request's team. The dashboard may *display*
  // requests grouped by product, but ordering uniqueness lives at the team
  // level — a team has one priority sequence across all its requests.
  const { data: current, error: curErr } = await supabase
    .from("requests")
    .select("id, team_id, team_priority")
    .eq("id", requestId)
    .maybeSingle<{
      id: string;
      team_id: string | null;
      team_priority: number;
    }>();
  if (curErr) throw new Error(curErr.message);
  if (!current) throw new Error("Request not found");

  const delta = direction === "up" ? -1 : 1;
  const target = Math.max(0, current.team_priority + delta);

  await resequenceTeamPriorities(
    supabase,
    current.team_id,
    requestId,
    target
  );

  revalidatePath("/");
  return { ok: true };
}
