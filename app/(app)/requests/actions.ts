"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { authedAction, adminAction, canManageTeam } from "@/lib/actions/utils";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyWorkstreamOwners } from "@/lib/notifications";
import { resolveFieldsForProduct } from "@/lib/workstream-template";
import * as priority from "@/lib/priority";
import type {
  FieldDefinition,
  FieldType,
  FieldValue,
  RequestRow,
} from "@/lib/types";
import type { Database } from "@/lib/database.types";
import type { SubmitResult } from "@/lib/request-actions-types";

type RequestUpdate = Database["public"]["Tables"]["requests"]["Update"];

const VALID_FIELD_TYPES: FieldType[] = [
  "short_text",
  "long_text",
  "url",
  "file",
  "image",
  "select",
  "multi_select",
  "checkbox",
  "repo",
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
  /** YYYY-MM-DD or null. */
  deadline: string | null;
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
  // Postgres `date` column. Accept YYYY-MM-DD or null.
  deadline: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date")
    .nullable(),
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

  // Priority is per (team, product). A new draft has no product yet, so it
  // lands in the (author's team, null product) group at max+1.
  const nextTeamPriority = await priority.nextSlot(
    supabase,
    profile.team_id,
    null
  );

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

  // Priority is per (team, product). If the product changes, this row moves
  // from one priority group to another — slot it at max+1 in the new
  // (team, product) group so it doesn't collide with an existing value.
  const { data: before } = await supabase
    .from("requests")
    .select("team_id, product_id")
    .eq("id", requestId)
    .maybeSingle<{ team_id: string | null; product_id: string | null }>();

  const oldProductId = before?.product_id ?? null;
  const productChanged = parsed.productId !== oldProductId;

  let nextTeamPriority: number | undefined;
  let nextWorkstreamPriority: number | undefined;
  if (productChanged) {
    // Reslot the requester rank in the new (team, product) group…
    nextTeamPriority = await priority.nextSlot(
      supabase,
      before?.team_id ?? null,
      parsed.productId
    );
    // …and the workstream rank at the end of the new workstream (0 when the
    // request now has no workstream).
    nextWorkstreamPriority = await priority.nextWorkstreamSlot(
      supabase,
      parsed.productId
    );
  }

  const updates: RequestUpdate = {
    title,
    summary: summary.length === 0 ? null : summary,
    product_id: parsed.productId,
    deadline: parsed.deadline,
  };
  if (nextTeamPriority !== undefined) {
    updates.team_priority = nextTeamPriority;
  }
  if (nextWorkstreamPriority !== undefined) {
    updates.workstream_priority = nextWorkstreamPriority;
  }

  const { error: reqErr } = await supabase
    .from("requests")
    .update(updates)
    .eq("id", requestId);
  if (reqErr) throw new Error(reqErr.message);

  // Close the gap the move left in the OLD workstream's ranking.
  if (productChanged && oldProductId && oldProductId !== parsed.productId) {
    await priority.compactWorkstream(supabase, oldProductId);
  }

  // Only persist values for fields in THIS workstream's template. Resolving by
  // the new product_id means switching workstreams stops accepting values for
  // fields that workstream doesn't collect (and a request with no workstream
  // saves no custom values at all).
  const fields = await resolveFieldsForProduct(supabase, parsed.productId);
  if (fields.length === 0) return;

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

/**
 * Resolve a workstream's template for the request form. Called client-side when
 * the author changes the workstream dropdown so the field set re-renders. Any
 * authenticated user filling in a form may call it (read-only).
 */
export async function getRequestTemplate(
  productId: string | null
): Promise<FieldDefinition[]> {
  const { supabase } = await authedAction();
  return resolveFieldsForProduct(supabase, productId);
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

  // The request's template is per workstream, and persistFormState above may
  // have just changed the workstream — so read the current product_id and
  // resolve the fields (and required levels) for it.
  const { data: cur, error: curErr } = await supabase
    .from("requests")
    .select("product_id, summary")
    .eq("id", requestId)
    .maybeSingle<{ product_id: string | null; summary: string | null }>();
  if (curErr) throw new Error(curErr.message);
  const currentProductId = cur?.product_id ?? null;

  const fields = await resolveFieldsForProduct(supabase, currentProductId);

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
    // Repo fields are owner-configured (a workstream repo link), not filled in
    // by the author — so they never count as "missing".
    if (type === "repo") return true;
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

  const hardMissing = fields
    .filter((f) => f.required_level === "hard" && !isFilled(f))
    .map((f) => ({ id: f.id, label: f.label }));

  // Summary is a built-in field on the request row (read alongside product_id
  // above, since persistFormState may have just changed both).
  const persistedSummary = cur?.summary ?? null;
  if (!persistedSummary || persistedSummary.trim().length === 0) {
    hardMissing.unshift({ id: "__summary__", label: "Summary" });
  }

  // A workstream is required to submit — its owner's template defines what this
  // request must include, so there's nothing to validate against without one.
  if (!currentProductId) {
    hardMissing.unshift({ id: "__workstream__", label: "Workstream" });
  }

  if (hardMissing.length > 0) {
    return { ok: false, kind: "hard", missing: hardMissing };
  }

  const softMissing = fields
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

  // Alert the owning team(s) of this workstream that a new request landed.
  // Awaited (serverless freezes background work after the response) but
  // internally failure-tolerant, so it never blocks the submit.
  await notifyWorkstreamOwners({
    requestId,
    actorId: ctx.profile.id,
    event: { kind: "submitted" },
  });

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
  const { supabase, profile } = await adminAction();

  // Read the prior status so we only alert on an ACTUAL change (re-selecting
  // the same status is a no-op and shouldn't email anyone).
  const { data: before } = await supabase
    .from("requests")
    .select("status_id")
    .eq("id", requestId)
    .maybeSingle<{ status_id: string | null }>();

  const { error } = await supabase
    .from("requests")
    .update({ status_id: statusId })
    .eq("id", requestId);
  if (error) throw new Error(error.message);

  if (before?.status_id !== statusId) {
    const { data: st } = await supabase
      .from("statuses")
      .select("label")
      .eq("id", statusId)
      .maybeSingle<{ label: string }>();
    await notifyWorkstreamOwners({
      requestId,
      actorId: profile.id,
      event: { kind: "status_changed", statusLabel: st?.label ?? "Updated" },
    });
  }

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

  // Capture the (team, product) before deletion so we can compact that
  // priority group after the gap appears.
  const { data: doomed } = await supabase
    .from("requests")
    .select("team_id, product_id")
    .eq("id", requestId)
    .maybeSingle<{ team_id: string | null; product_id: string | null }>();

  const { error } = await supabase.from("requests").delete().eq("id", requestId);
  if (error) throw new Error(error.message);

  // Close the gap the deleted row left in both rankings it belonged to.
  await priority.compact(
    supabase,
    doomed?.team_id ?? null,
    doomed?.product_id ?? null
  );
  await priority.compactWorkstream(supabase, doomed?.product_id ?? null);

  revalidatePath("/");
  revalidatePath("/requests/mine");
  redirect("/");
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

export async function setTeamPriority(
  requestId: string,
  value: number
): Promise<{ ok: true }> {
  if (!Number.isFinite(value) || value < 0 || value > 1_000_000) {
    throw new Error("Priority must be a positive number");
  }
  const { supabase, profile } = await authedAction();

  // Read the request's group (reads are open to all authenticated users).
  const { data: current, error: curErr } = await supabase
    .from("requests")
    .select("id, team_id, product_id")
    .eq("id", requestId)
    .maybeSingle();
  if (curErr) throw new Error(curErr.message);
  if (!current) throw new Error("Request not found");

  // Global admins may reorder any team; team admins only their own team.
  if (!canManageTeam(profile, current.team_id)) {
    throw new Error("You don't manage this team's priorities.");
  }

  // Write via the service-role client (team admins have no direct RLS write
  // on requests; the check above is the boundary).
  const admin = createAdminClient();
  await priority.resequence(
    admin,
    current.team_id,
    current.product_id,
    requestId,
    Math.round(value)
  );

  revalidatePath("/");
  return { ok: true };
}

/**
 * Set a request's WORKSTREAM priority — the owning team's rank of the request
 * across all requests in its workstream. Only a global admin or a team admin
 * whose team owns the workstream may change it.
 */
export async function setWorkstreamPriority(
  requestId: string,
  value: number
): Promise<{ ok: true }> {
  if (!Number.isFinite(value) || value < 0 || value > 1_000_000) {
    throw new Error("Priority must be a positive number");
  }
  const { supabase, profile } = await authedAction();

  const { data: current, error: curErr } = await supabase
    .from("requests")
    .select("id, product_id")
    .eq("id", requestId)
    .maybeSingle();
  if (curErr) throw new Error(curErr.message);
  if (!current) throw new Error("Request not found");
  if (!current.product_id) {
    throw new Error("This request isn't in a workstream.");
  }

  // Authorize: global admin, or a team admin whose team owns this workstream.
  let authorized = profile.role === "admin";
  if (!authorized && profile.role === "team_admin" && profile.team_id) {
    const { data: owns } = await supabase
      .from("product_owners")
      .select("team_id")
      .eq("product_id", current.product_id)
      .eq("team_id", profile.team_id)
      .maybeSingle();
    authorized = Boolean(owns);
  }
  if (!authorized) {
    throw new Error("Only the workstream's owning team can set this priority.");
  }

  const admin = createAdminClient();
  await priority.resequenceWorkstream(
    admin,
    current.product_id,
    requestId,
    Math.round(value)
  );

  revalidatePath("/");
  return { ok: true };
}
