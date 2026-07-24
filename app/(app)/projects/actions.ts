"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { authedAction } from "@/lib/actions/utils";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile } from "@/lib/types";

const uuidSchema = z.string().uuid();

const projectSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  description: z.string().trim().max(5000).optional().default(""),
  isPrivate: z.boolean().optional().default(false),
});

/** Global admin or the project's owner. */
function canManageProject(profile: Profile, ownerId: string): boolean {
  return profile.role === "admin" || profile.id === ownerId;
}

export async function createProject(input: {
  name: string;
  description?: string;
  isPrivate?: boolean;
}): Promise<{ id: string }> {
  const { supabase, profile } = await authedAction();
  const parsed = projectSchema.parse(input);

  const { data, error } = await supabase
    .from("projects")
    .insert({
      name: parsed.name,
      description: parsed.description.length > 0 ? parsed.description : null,
      owner_id: profile.id,
      is_private: parsed.isPrivate,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    throw new Error(error?.message ?? "Could not create project");
  }

  revalidatePath("/projects");
  return { id: data.id };
}

export async function updateProject(
  projectId: string,
  input: { name: string; description?: string; isPrivate?: boolean }
): Promise<{ ok: true }> {
  const id = uuidSchema.parse(projectId);
  const { supabase, profile } = await authedAction();
  const parsed = projectSchema.parse(input);

  const { data: existing, error: readErr } = await supabase
    .from("projects")
    .select("owner_id")
    .eq("id", id)
    .maybeSingle<{ owner_id: string }>();
  if (readErr) throw new Error(readErr.message);
  if (!existing) throw new Error("Project not found");
  if (!canManageProject(profile, existing.owner_id)) {
    throw new Error("You don't manage this project.");
  }

  const { error } = await supabase
    .from("projects")
    .update({
      name: parsed.name,
      description: parsed.description.length > 0 ? parsed.description : null,
      is_private: parsed.isPrivate,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
  return { ok: true };
}

export async function deleteProject(projectId: string): Promise<void> {
  const id = uuidSchema.parse(projectId);
  const { supabase, profile } = await authedAction();

  const { data: existing, error: readErr } = await supabase
    .from("projects")
    .select("owner_id")
    .eq("id", id)
    .maybeSingle<{ owner_id: string }>();
  if (readErr) throw new Error(readErr.message);
  if (!existing) throw new Error("Project not found");
  if (!canManageProject(profile, existing.owner_id)) {
    throw new Error("You don't manage this project.");
  }

  // Requests unlink automatically (project_id -> null via ON DELETE SET NULL).
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/projects");
  redirect("/projects");
}

/**
 * Attach a request to a project (or detach with projectId = null). The caller
 * must author the request (or be an admin), and — when attaching — must own the
 * target project (or be an admin). Authors already hold update rights on their
 * own requests in any state, so this writes through the normal request path.
 */
export async function setRequestProject(
  requestId: string,
  projectId: string | null
): Promise<{ ok: true }> {
  const reqId = uuidSchema.parse(requestId);
  const projId = projectId === null ? null : uuidSchema.parse(projectId);
  const { supabase, profile } = await authedAction();

  const { data: req, error: reqErr } = await supabase
    .from("requests")
    .select("author_id, project_id")
    .eq("id", reqId)
    .maybeSingle<{ author_id: string; project_id: string | null }>();
  if (reqErr) throw new Error(reqErr.message);
  if (!req) throw new Error("Request not found");

  const isAdmin = profile.role === "admin";
  if (!isAdmin && req.author_id !== profile.id) {
    throw new Error("Only the request's author or an admin can move it.");
  }

  if (projId) {
    const { data: proj, error: projErr } = await supabase
      .from("projects")
      .select("owner_id")
      .eq("id", projId)
      .maybeSingle<{ owner_id: string }>();
    if (projErr) throw new Error(projErr.message);
    if (!proj) throw new Error("Project not found");
    if (!canManageProject(profile, proj.owner_id)) {
      throw new Error("You can only add requests to your own projects.");
    }
  }

  const { error } = await supabase
    .from("requests")
    .update({ project_id: projId })
    .eq("id", reqId);
  if (error) throw new Error(error.message);

  revalidatePath("/projects");
  if (projId) revalidatePath(`/projects/${projId}`);
  if (req.project_id) revalidatePath(`/projects/${req.project_id}`);
  revalidatePath(`/requests/${reqId}`);
  revalidatePath("/requests/mine");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Request-to-request dependencies (scoped to a project). "A depends on B" means
// A is blocked by B. Manageable by the project owner, the dependent request's
// author, or an admin. Both requests must live in the same project.
// ---------------------------------------------------------------------------

/** Authorize a dependency change on `requestId`; returns the shared project id. */
async function assertCanManageDeps(
  requestId: string,
  dependsOnId: string,
  ctx: Awaited<ReturnType<typeof authedAction>>
): Promise<string> {
  const { supabase, profile } = ctx;
  const { data: reqs } = await supabase
    .from("requests")
    .select("id, project_id, author_id")
    .in("id", [requestId, dependsOnId])
    .returns<{ id: string; project_id: string | null; author_id: string }[]>();
  const a = reqs?.find((r) => r.id === requestId);
  const b = reqs?.find((r) => r.id === dependsOnId);
  if (!a || !b) throw new Error("Request not found");
  if (!a.project_id || a.project_id !== b.project_id) {
    throw new Error("Both requests must be in the same project.");
  }

  let ok = profile.role === "admin" || a.author_id === profile.id;
  if (!ok) {
    const { data: proj } = await supabase
      .from("projects")
      .select("owner_id")
      .eq("id", a.project_id)
      .maybeSingle<{ owner_id: string }>();
    ok = proj?.owner_id === profile.id;
  }
  if (!ok) {
    throw new Error("You can't change dependencies for this request.");
  }
  return a.project_id;
}

export async function setRequestDependency(
  requestId: string,
  dependsOnId: string
): Promise<{ ok: true }> {
  const a = uuidSchema.parse(requestId);
  const b = uuidSchema.parse(dependsOnId);
  if (a === b) throw new Error("A request can't depend on itself.");
  const ctx = await authedAction();
  const projectId = await assertCanManageDeps(a, b, ctx);

  // Reject the direct reverse edge so we can't make an A⇄B cycle.
  const { data: reverse } = await ctx.supabase
    .from("request_dependencies")
    .select("request_id")
    .eq("request_id", b)
    .eq("depends_on_id", a)
    .maybeSingle();
  if (reverse) {
    throw new Error("That would create a circular dependency.");
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("request_dependencies")
    .upsert(
      { request_id: a, depends_on_id: b },
      { onConflict: "request_id,depends_on_id", ignoreDuplicates: true }
    );
  if (error) throw new Error(error.message);

  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function removeRequestDependency(
  requestId: string,
  dependsOnId: string
): Promise<{ ok: true }> {
  const a = uuidSchema.parse(requestId);
  const b = uuidSchema.parse(dependsOnId);
  const ctx = await authedAction();
  const projectId = await assertCanManageDeps(a, b, ctx);

  const admin = createAdminClient();
  const { error } = await admin
    .from("request_dependencies")
    .delete()
    .eq("request_id", a)
    .eq("depends_on_id", b);
  if (error) throw new Error(error.message);

  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}
