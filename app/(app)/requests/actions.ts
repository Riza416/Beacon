"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { authedAction, adminAction } from "@/lib/actions/utils";
import type { FieldDefinition, FieldValue, RequestRow } from "@/lib/types";
import type { SubmitResult } from "@/lib/request-actions-types";

type FormValues = Record<string, string | boolean>;

interface FormState {
  title: string;
  summary: string;
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
  const isAuthorDraft = data.author_id === profile.id && data.state === "draft";
  if (!isAdmin && !isAuthorDraft) {
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

  const { data: inserted, error } = await supabase
    .from("requests")
    .insert({
      title: "Untitled draft",
      author_id: profile.id,
      state: "draft",
      status_id: defaultStatus?.id ?? null,
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

  const { error: reqErr } = await supabase
    .from("requests")
    .update({
      title,
      summary: summary.length === 0 ? null : summary,
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

  const rows = fields
    .map((f) => {
      const raw = parsed.values[f.id];
      if (raw === undefined) return null;
      let value_text: string | null = null;
      if (f.field_type === "checkbox") {
        value_text = (raw === true || raw === "true") ? "true" : "false";
      } else if (typeof raw === "string") {
        const trimmed = raw.trim();
        value_text = trimmed.length === 0 ? null : trimmed;
      }
      // File / image: ignore here — file_path is updated via setFieldFile.
      if (f.field_type === "file" || f.field_type === "image") return null;
      return {
        request_id: requestId,
        field_definition_id: f.id,
        value_text,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (rows.length > 0) {
    const { error: upErr } = await supabase
      .from("request_field_values")
      .upsert(rows, { onConflict: "request_id,field_definition_id" });
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

  const byField = new Map<string, FieldValue>();
  for (const v of values ?? []) byField.set(v.field_definition_id, v);

  function isFilled(f: FieldDefinition): boolean {
    const v = byField.get(f.id);
    if (!v) return false;
    if (f.field_type === "file" || f.field_type === "image") {
      return Boolean(v.file_path && v.file_path.length > 0);
    }
    if (f.field_type === "checkbox") {
      // Checkbox "required" means it must be checked.
      return v.value_text === "true";
    }
    if (f.field_type === "multi_select") {
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
  filePath: string | null
): Promise<{ ok: true }> {
  const ctx = await authedAction();
  await assertEditable(requestId, ctx);
  const { supabase } = ctx;

  const { error } = await supabase
    .from("request_field_values")
    .upsert(
      {
        request_id: requestId,
        field_definition_id: fieldId,
        file_path: filePath,
      },
      { onConflict: "request_id,field_definition_id" }
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
  const { supabase } = await adminAction();
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
  const { error } = await supabase.from("requests").delete().eq("id", requestId);
  if (error) throw new Error(error.message);
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
