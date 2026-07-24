"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { authedAction } from "@/lib/actions/utils";
import type { Profile } from "@/lib/types";

const uuidSchema = z.string().uuid();

const projectSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  description: z.string().trim().max(5000).optional().default(""),
});

/** Global admin or the project's owner. */
function canManageProject(profile: Profile, ownerId: string): boolean {
  return profile.role === "admin" || profile.id === ownerId;
}

export async function createProject(input: {
  name: string;
  description?: string;
}): Promise<{ id: string }> {
  const { supabase, profile } = await authedAction();
  const parsed = projectSchema.parse(input);

  const { data, error } = await supabase
    .from("projects")
    .insert({
      name: parsed.name,
      description: parsed.description.length > 0 ? parsed.description : null,
      owner_id: profile.id,
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
  input: { name: string; description?: string }
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
