"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  addTeamTag,
  removeTeamTag,
  createDraft,
  saveDraft,
  submitRequest,
  setFieldFile,
  getRequestTemplate,
} from "@/app/(app)/requests/actions";
import { X, Lock } from "lucide-react";
import { ScreenshotInput } from "@/components/screenshot-input";
import { RepoActions } from "@/components/repo-actions";
import type { SubmitResult } from "@/lib/request-actions-types";
import type {
  FieldDefinition,
  FieldType,
  FieldValue,
  RequestRow,
} from "@/lib/types";

interface RequestFormProps {
  /** The existing request row, or null when composing a brand-new request that
   * has not been persisted yet. In "new" mode the row is created lazily on the
   * first explicit save/submit (see ensureId). */
  request: RequestRow | null;
  fields: FieldDefinition[];
  values: FieldValue[];
  canSubmit: boolean;
  /** Whether the current user is on a team. Submission is blocked when false. */
  hasTeam: boolean;
  /** Current user's id; used as the storage path prefix. */
  uploaderId: string;
  /** Signed URLs (keyed by storage path) for any existing image attachments,
   * so the form can show a preview of what's already saved. */
  signedUrls?: Record<string, string>;
  /** Admin-configured catalog the author picks one of, with each workstream's
   * built-in-field visibility flags. */
  products: {
    id: string;
    name: string;
    show_deadline: boolean;
    show_dependent_teams: boolean;
  }[];
  /** All teams in the workspace, used by the dependent-teams picker below
   * the deadline field. */
  allTeams: { id: string; name: string }[];
  /** Team ids already tagged as dependencies for this request. */
  initialTaggedTeamIds: string[];
  /** The author's own team id, if any. Excluded from the "Add team" dropdown
   * because the author's team isn't a dependency. */
  authorTeamId: string | null;
  /** The caller's own projects, offered in the "Project" picker so a request
   * can be filed under one. Empty when the user has no projects. */
  projects?: { id: string; name: string }[];
  /** Project preselected for this request (its current project, or one passed
   * via ?project= when composing from a project page). */
  initialProjectId?: string | null;
}

type FormValue = string | boolean | string[];

const TYPE_CAPTIONS: Record<FieldType, string> = {
  short_text: "Short answer",
  long_text: "Detailed answer",
  url: "Link",
  file: "File",
  image: "Screenshot",
  select: "",
  multi_select: "Pick several",
  checkbox: "Yes / no",
  repo: "Repository",
};

function fieldKey(fieldId: string, type: FieldType): string {
  return `${fieldId}::${type}`;
}

function allowedTypes(field: FieldDefinition): FieldType[] {
  return field.field_types && field.field_types.length > 0
    ? field.field_types
    : [field.field_type];
}

function parseMultiSelect(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function valueForType(type: FieldType, v: FieldValue | undefined): FormValue {
  if (!v) {
    if (type === "checkbox") return false;
    if (type === "multi_select") return [];
    return "";
  }
  if (type === "checkbox") return v.value_text === "true";
  if (type === "multi_select") return parseMultiSelect(v.value_text);
  return v.value_text ?? "";
}

export function RequestForm({
  request,
  fields: initialFields,
  values,
  canSubmit,
  hasTeam,
  uploaderId,
  signedUrls,
  products,
  allTeams,
  initialTaggedTeamIds,
  authorTeamId,
  projects = [],
  initialProjectId = null,
}: RequestFormProps) {
  const router = useRouter();
  const pathname = usePathname();

  // "New" mode: request is null until the author explicitly saves/submits.
  // existingId is fixed for the life of this instance; newId is filled the
  // first (and only) time we lazily create the row. effectiveId is whichever
  // one we have — null while a brand-new request is still unsaved.
  const existingId = request?.id ?? null;
  const [newId, setNewId] = React.useState<string | null>(null);
  const effectiveId = existingId ?? newId;

  // In new mode there's no row yet, so treat the state as a draft.
  const isDraft = !request || request.state === "draft";

  // Unsaved-changes flag. Set true by every input handler; cleared after a
  // successful save/submit. Drives the beforeunload + in-app navigation guards.
  const [dirty, setDirty] = React.useState(false);

  // Create the backing draft row AT MOST ONCE per form instance. The first call
  // inserts a row and remembers its id via newId; every later call (including
  // the "Submit anyway" path after a soft-confirm) sees effectiveId already set
  // and returns it without calling createDraft again.
  async function ensureId(): Promise<string> {
    if (effectiveId) return effectiveId;
    const { id } = await createDraft();
    setNewId(id);
    return id;
  }

  const [title, setTitle] = React.useState(request?.title ?? "");
  const [summary, setSummary] = React.useState(request?.summary ?? "");
  const [productId, setProductId] = React.useState<string | null>(
    request?.product_id ?? null
  );
  // Only preselect a project we can actually offer (one the caller owns). A
  // ?project= for someone else's project — or a stale one — falls back to none.
  const [projectId, setProjectId] = React.useState<string | null>(() =>
    initialProjectId && projects.some((p) => p.id === initialProjectId)
      ? initialProjectId
      : null
  );

  // Fields are the SELECTED workstream's template. Seeded from the server for
  // the initial workstream; refetched when the author switches workstream so
  // the requirements always match what that workstream's owner configured.
  const [isPrivate, setIsPrivate] = React.useState<boolean>(
    request?.is_private ?? false
  );
  const [fields, setFields] = React.useState<FieldDefinition[]>(initialFields);
  const [templateLoading, setTemplateLoading] = React.useState(false);
  const didMount = React.useRef(false);

  React.useEffect(() => {
    // Skip the first run — the server already gave us the initial template.
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    let cancelled = false;
    setTemplateLoading(true);
    getRequestTemplate(productId)
      .then((next) => {
        if (!cancelled) setFields(next);
      })
      .catch(() => {
        if (!cancelled)
          toast.error("Couldn't load this workstream's fields");
      })
      .finally(() => {
        if (!cancelled) setTemplateLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [productId]);
  const [deadline, setDeadline] = React.useState<string>(
    request?.deadline ?? ""
  );

  // Per-(field, type) values keyed by `${field_id}::${type}`.
  const initialFormValues = React.useMemo<Record<string, FormValue>>(() => {
    const byKey = new Map<string, FieldValue>();
    for (const v of values) {
      byKey.set(fieldKey(v.field_definition_id, v.field_type), v);
    }
    const map: Record<string, FormValue> = {};
    for (const f of fields) {
      for (const t of allowedTypes(f)) {
        const k = fieldKey(f.id, t);
        map[k] = valueForType(t, byKey.get(k));
      }
    }
    return map;
  }, [fields, values]);
  const [formValues, setFormValues] =
    React.useState<Record<string, FormValue>>(initialFormValues);

  // file_path per (field, type) for file/image sub-inputs.
  const initialFilePaths = React.useMemo<Record<string, string | null>>(() => {
    const byKey = new Map<string, FieldValue>();
    for (const v of values) {
      byKey.set(fieldKey(v.field_definition_id, v.field_type), v);
    }
    const map: Record<string, string | null> = {};
    for (const f of fields) {
      for (const t of allowedTypes(f)) {
        if (t === "file" || t === "image") {
          const k = fieldKey(f.id, t);
          map[k] = byKey.get(k)?.file_path ?? null;
        }
      }
    }
    return map;
  }, [fields, values]);
  const [filePaths, setFilePaths] =
    React.useState<Record<string, string | null>>(initialFilePaths);
  const [uploadingKey, setUploadingKey] = React.useState<string | null>(null);

  // When the resolved template changes (workstream switched), make sure every
  // current field key has an entry — seeding new ones from saved values —
  // without wiping anything the author already typed for fields that remain.
  React.useEffect(() => {
    const byKey = new Map<string, FieldValue>();
    for (const v of values) {
      byKey.set(fieldKey(v.field_definition_id, v.field_type), v);
    }
    setFormValues((prev) => {
      const next = { ...prev };
      for (const f of fields) {
        for (const t of allowedTypes(f)) {
          const k = fieldKey(f.id, t);
          if (!(k in next)) next[k] = valueForType(t, byKey.get(k));
        }
      }
      return next;
    });
    setFilePaths((prev) => {
      const next = { ...prev };
      for (const f of fields) {
        for (const t of allowedTypes(f)) {
          if (t === "file" || t === "image") {
            const k = fieldKey(f.id, t);
            if (!(k in next)) next[k] = byKey.get(k)?.file_path ?? null;
          }
        }
      }
      return next;
    });
  }, [fields, values]);

  const [isPending, startTransition] = React.useTransition();
  const [softModal, setSoftModal] = React.useState<{
    open: boolean;
    missing: { id: string; label: string }[];
  }>({ open: false, missing: [] });

  // In-app navigation guard: the href a captured anchor click was headed to,
  // held while the "Save this draft?" dialog asks what to do.
  const [pendingHref, setPendingHref] = React.useState<string | null>(null);
  const [leaveModalOpen, setLeaveModalOpen] = React.useState(false);
  const [leaving, setLeaving] = React.useState(false);

  // Dependent teams: kept as a Set for O(1) membership checks when rendering
  // the chip list and filtering the "Add team" dropdown. Mutates via the
  // existing addTeamTag / removeTeamTag server actions — not through saveDraft.
  const [taggedTeamIds, setTaggedTeamIds] = React.useState<Set<string>>(
    () => new Set(initialTaggedTeamIds)
  );
  const [teamTagPending, startTeamTagTransition] = React.useTransition();
  const [pendingTeamSelection, setPendingTeamSelection] = React.useState<
    string | null
  >(null);

  const teamsById = React.useMemo(() => {
    const m = new Map<string, { id: string; name: string }>();
    for (const t of allTeams) m.set(t.id, t);
    return m;
  }, [allTeams]);

  // Untagged + not the author's own team. The author's team isn't a
  // dependency on itself; the user explicitly asked for "OTHER teams" only.
  const availableTeams = React.useMemo(
    () =>
      allTeams.filter(
        (t) => !taggedTeamIds.has(t.id) && t.id !== authorTeamId
      ),
    [allTeams, taggedTeamIds, authorTeamId]
  );

  function addTeam(teamId: string) {
    if (taggedTeamIds.has(teamId)) return;
    const team = teamsById.get(teamId);
    setDirty(true);
    // Optimistic update so the chip appears immediately; rollback on failure.
    setTaggedTeamIds((prev) => {
      const next = new Set(prev);
      next.add(teamId);
      return next;
    });
    setPendingTeamSelection(null);
    startTeamTagTransition(async () => {
      try {
        // Lazily create the draft if this is a brand-new request, so tagging a
        // team doesn't require an explicit save first.
        const id = await ensureId();
        await addTeamTag(id, teamId);
        toast.success(`Tagged team ${team?.name ?? ""}`.trim());
        router.refresh();
      } catch (err) {
        setTaggedTeamIds((prev) => {
          const next = new Set(prev);
          next.delete(teamId);
          return next;
        });
        const message =
          err instanceof Error ? err.message : "Could not tag team";
        toast.error(message);
      }
    });
  }

  function removeTeam(teamId: string) {
    if (!effectiveId) return;
    const team = teamsById.get(teamId);
    setDirty(true);
    setTaggedTeamIds((prev) => {
      const next = new Set(prev);
      next.delete(teamId);
      return next;
    });
    startTeamTagTransition(async () => {
      try {
        await removeTeamTag(effectiveId, teamId);
        toast.success(`Untagged team ${team?.name ?? ""}`.trim());
        router.refresh();
      } catch (err) {
        setTaggedTeamIds((prev) => {
          const next = new Set(prev);
          next.add(teamId);
          return next;
        });
        const message =
          err instanceof Error ? err.message : "Could not untag team";
        toast.error(message);
      }
    });
  }

  function buildFormState() {
    const valuesPayload: Record<string, string | boolean> = {};
    for (const f of fields) {
      for (const t of allowedTypes(f)) {
        const k = fieldKey(f.id, t);
        const v = formValues[k];
        if (v === undefined) continue;
        // Multi-select is serialized to JSON so it fits in value_text.
        if (Array.isArray(v)) {
          valuesPayload[k] = JSON.stringify(v);
        } else {
          valuesPayload[k] = v;
        }
      }
    }
    return {
      title,
      summary,
      productId,
      projectId,
      isPrivate,
      deadline: deadline ? deadline : null,
      values: valuesPayload,
    };
  }

  function onSave() {
    startTransition(async () => {
      try {
        // Capture brand-new-ness BEFORE ensureId creates the row: a request is
        // brand-new when it arrived without an existing id.
        const brandNew = !existingId;
        const id = await ensureId();
        await saveDraft(id, buildFormState());
        setDirty(false);
        if (brandNew) {
          // The draft now exists — move into the normal edit route for it.
          router.push(`/requests/${id}/edit`);
        } else {
          toast.success(isDraft ? "Draft saved" : "Request updated");
          router.refresh();
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not save";
        toast.error(message);
      }
    });
  }

  function doSubmit(force: boolean) {
    startTransition(async () => {
      try {
        const brandNew = !existingId;
        // ensureId is idempotent: on the "Submit anyway" (force) path the row
        // was already created by the first doSubmit call, so this returns the
        // same id and never creates a second draft.
        const id = await ensureId();
        const result: SubmitResult = await submitRequest(
          id,
          buildFormState(),
          { force }
        );
        if (result.ok) {
          setDirty(false);
          toast.success("Request submitted — you can still edit anytime");
          setSoftModal({ open: false, missing: [] });
          if (brandNew) {
            // A freshly-composed request lands on its detail page.
            router.push(`/requests/${id}`);
          } else {
            // Stay on the edit page so the user feels they still own the
            // request post-submission. The Submit button will disappear on
            // re-render (canSubmit becomes false for non-draft), but Save
            // and all field inputs remain usable.
            router.refresh();
          }
          return;
        }
        if (result.kind === "hard") {
          toast.error(
            `Required: ${result.missing.map((m) => m.label).join(", ")}`
          );
          // The draft was saved by submitRequest before it failed validation —
          // send a brand-new one to its edit page so the author can fix it.
          if (brandNew) {
            router.push(`/requests/${id}/edit`);
          }
          return;
        }
        // soft — the row already exists (ensureId ran); confirm to force-submit.
        setSoftModal({ open: true, missing: result.missing });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not submit";
        toast.error(message);
      }
    });
  }

  // Save path used by the "Save this draft?" navigation guard. Same lazy-create
  // + persist as onSave, but it never redirects — the caller pushes to the
  // pending destination once the save resolves.
  async function saveForLeave(): Promise<void> {
    const id = await ensureId();
    await saveDraft(id, buildFormState());
  }

  // Warn on tab close / refresh while there are unsaved changes. Only attached
  // while dirty so it never nags once everything's saved.
  React.useEffect(() => {
    if (!dirty) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  // In-app navigation guard. A document-level capture click listener (active
  // only while dirty) intercepts internal anchor clicks and opens the "Save
  // this draft?" dialog instead of letting the navigation proceed. It is kept
  // deliberately narrow so it never blocks the form's own buttons — it only
  // reacts to <a href="…"> elements.
  React.useEffect(() => {
    if (!dirty) return;
    function onClickCapture(e: MouseEvent) {
      // Respect anything already handled, non-primary clicks, and
      // modifier-clicks (open-in-new-tab, download, etc.).
      if (e.defaultPrevented) return;
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const target = e.target as Element | null;
      const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target === "_blank") return;
      const href = anchor.getAttribute("href");
      // Internal links only, and not a click that stays on the current page.
      if (!href || !href.startsWith("/")) return;
      if (href === pathname) return;
      e.preventDefault();
      e.stopPropagation();
      setPendingHref(href);
      setLeaveModalOpen(true);
    }
    document.addEventListener("click", onClickCapture, true);
    return () => document.removeEventListener("click", onClickCapture, true);
  }, [dirty, pathname]);

  function closeLeaveModal() {
    setLeaveModalOpen(false);
    setPendingHref(null);
  }

  function leaveWithoutSaving() {
    const href = pendingHref;
    setDirty(false);
    setLeaveModalOpen(false);
    setPendingHref(null);
    if (href) router.push(href);
  }

  function saveThenLeave() {
    const href = pendingHref;
    setLeaving(true);
    startTransition(async () => {
      try {
        await saveForLeave();
        setDirty(false);
        setLeaveModalOpen(false);
        setPendingHref(null);
        if (href) router.push(href);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not save";
        toast.error(message);
      } finally {
        setLeaving(false);
      }
    });
  }

  async function onFileChange(
    field: FieldDefinition,
    type: FieldType,
    file: File | null
  ) {
    if (!file) return;
    setDirty(true);
    const k = fieldKey(field.id, type);
    setUploadingKey(k);
    try {
      // Uploads target a storage path under the row id. Rather than block until
      // the author manually saves, lazily create the draft here — uploading a
      // file is itself an explicit, intentful action.
      const id = await ensureId();
      const supabase = createClient();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${uploaderId}/${id}/${field.id}/${type}/${Date.now()}-${safeName}`;
      const { error } = await supabase.storage
        .from("request-attachments")
        .upload(path, file, { upsert: true });
      if (error) throw new Error(error.message);
      await setFieldFile(id, field.id, type, path);
      setFilePaths((prev) => ({ ...prev, [k]: path }));
      toast.success("File uploaded");
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      toast.error(message);
    } finally {
      setUploadingKey(null);
    }
  }

  function setValue(key: string, next: FormValue) {
    setDirty(true);
    setFormValues((prev) => ({ ...prev, [key]: next }));
  }

  // Built-in Deadline / Dependent-teams fields follow the SELECTED workstream's
  // template flags. Shown only once a workstream is picked (like the custom
  // fields), and only when that workstream keeps them on.
  const selectedProduct = productId
    ? products.find((p) => p.id === productId) ?? null
    : null;
  const showDeadline = selectedProduct?.show_deadline ?? false;
  const showDependentTeams = selectedProduct?.show_dependent_teams ?? false;

  function requiredMark(level: FieldDefinition["required_level"]) {
    if (level === "hard")
      return <span className="ml-1 text-destructive">*</span>;
    if (level === "soft")
      return <span className="ml-1 text-muted-foreground">·</span>;
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="product">Workstream</Label>
        <Select
          value={productId ?? "__none__"}
          onValueChange={(v) => {
            setDirty(true);
            setProductId(v === "__none__" ? null : v);
          }}
        >
          <SelectTrigger id="product">
            <SelectValue placeholder="Pick a workstream" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">No workstream</SelectItem>
            {products.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Choose the workstream first — it determines the rest of this form.
        </p>
        {products.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No workstreams configured yet — ask an admin to add some under{" "}
            <code>/admin/products</code>.
          </p>
        )}
      </div>

      {projects.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="project">Project</Label>
          <Select
            value={projectId ?? "__none__"}
            onValueChange={(v) => {
              setDirty(true);
              setProjectId(v === "__none__" ? null : v);
            }}
          >
            <SelectTrigger id="project">
              <SelectValue placeholder="No project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No project</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Optional. Group this request under one of your projects to track it
            alongside related requests.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label className="flex items-center gap-1.5">
          <Lock className="h-4 w-4" />
          Visibility
        </Label>
        <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3">
          <Checkbox
            checked={isPrivate}
            onCheckedChange={(c) => {
              setDirty(true);
              setIsPrivate(c === true);
            }}
            className="mt-0.5"
            aria-label="Make this request private"
          />
          <span className="space-y-0.5">
            <span className="block text-sm font-medium">
              Make this request private
            </span>
            <span className="block text-xs text-muted-foreground">
              {isPrivate
                ? "Only you, admins, the owning + dependent teams, and people you add can see this request."
                : "Anyone in the workspace can see this request (default)."}
            </span>
          </span>
        </label>
        {isPrivate && effectiveId && (
          <p className="text-xs text-muted-foreground">
            Add specific people under “Who can see this” on the request page
            after saving.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => {
            setDirty(true);
            setTitle(e.target.value);
          }}
          placeholder="Untitled draft"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="summary" className="flex items-center">
          <span>Summary</span>
          <span className="ml-1 text-destructive">*</span>
        </Label>
        <Textarea
          id="summary"
          value={summary}
          onChange={(e) => {
            setDirty(true);
            setSummary(e.target.value);
          }}
          placeholder="A short description of what you're asking for."
          rows={4}
        />
        <p className="text-xs text-muted-foreground">
          Required to submit. Save draft works without it.
        </p>
      </div>

      {showDeadline && (
      <div className="space-y-2">
        <Label htmlFor="deadline">Deadline</Label>
        <div className="flex items-center gap-2">
          <Input
            id="deadline"
            type="date"
            value={deadline}
            onChange={(e) => {
              setDirty(true);
              setDeadline(e.target.value);
            }}
            className="w-fit"
          />
          {deadline && (
            <button
              type="button"
              onClick={() => {
                setDirty(true);
                setDeadline("");
              }}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              Clear
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Optional. When does this need to be done by?
        </p>
      </div>
      )}

      {showDependentTeams && (
      <div className="space-y-2">
        <Label>Dependent teams</Label>
        <p className="text-xs text-muted-foreground">
          Tag any teams whose work this depends on. They&apos;ll see the
          request in their &quot;Tagged for me&quot; inbox.
        </p>
        {taggedTeamIds.size === 0 ? (
          <p className="text-sm text-muted-foreground">
            No teams tagged yet.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {Array.from(taggedTeamIds).map((teamId) => {
              const team = teamsById.get(teamId);
              const label = team?.name ?? "Unknown team";
              return (
                <li
                  key={teamId}
                  className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 py-1 pl-2.5 pr-1.5 text-xs"
                >
                  <span className="font-medium">{label}</span>
                  <button
                    type="button"
                    onClick={() => removeTeam(teamId)}
                    disabled={teamTagPending}
                    className="ml-1 flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground disabled:opacity-50"
                    aria-label={`Remove ${label}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {availableTeams.length > 0 ? (
          <div className="flex items-center gap-2">
            <Select
              value={pendingTeamSelection ?? ""}
              onValueChange={(v) => setPendingTeamSelection(v)}
              disabled={teamTagPending}
            >
              <SelectTrigger className="w-full sm:w-72">
                <SelectValue placeholder="Add a team…" />
              </SelectTrigger>
              <SelectContent>
                {availableTeams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!pendingTeamSelection || teamTagPending}
              onClick={() => {
                if (pendingTeamSelection) addTeam(pendingTeamSelection);
              }}
            >
              Add
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            {allTeams.length === 0
              ? "No teams configured yet."
              : "All other teams are already tagged."}
          </p>
        )}
      </div>
      )}

      {templateLoading && (
        <p className="text-sm text-muted-foreground">
          Loading this workstream&apos;s fields…
        </p>
      )}
      {!templateLoading && !productId && (
        <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          Pick a workstream above to see the details it asks for. A workstream
          is required to submit.
        </div>
      )}
      {!templateLoading && productId && fields.length === 0 && (
        <p className="text-sm text-muted-foreground">
          This workstream doesn&apos;t ask for any extra fields — just fill in
          the summary above.
        </p>
      )}

      {fields.map((f) => {
        const types = allowedTypes(f);
        const showSubLabels = types.length > 1;
        return (
          <div key={f.id} className="space-y-2">
            <Label className="flex items-center">
              <span>{f.label}</span>
              {requiredMark(f.required_level)}
            </Label>
            <div className="space-y-3">
              {types.map((t) => {
                const k = fieldKey(f.id, t);
                const v = formValues[k];
                const inputId = `field-${f.id}-${t}`;
                return (
                  <div key={k} className="space-y-1.5">
                    {showSubLabels && TYPE_CAPTIONS[t] && (
                      <Label
                        htmlFor={inputId}
                        className="text-xs font-normal text-muted-foreground"
                      >
                        {TYPE_CAPTIONS[t]}
                      </Label>
                    )}
                    {t === "short_text" && (
                      <Input
                        id={inputId}
                        value={typeof v === "string" ? v : ""}
                        onChange={(e) => setValue(k, e.target.value)}
                      />
                    )}
                    {t === "long_text" && (
                      <Textarea
                        id={inputId}
                        value={typeof v === "string" ? v : ""}
                        onChange={(e) => setValue(k, e.target.value)}
                        rows={4}
                      />
                    )}
                    {t === "url" && (
                      <Input
                        id={inputId}
                        type="url"
                        value={typeof v === "string" ? v : ""}
                        onChange={(e) => setValue(k, e.target.value)}
                        placeholder="https://"
                      />
                    )}
                    {t === "select" && (f.options ?? []).length > 0 && (
                      <Select
                        value={
                          typeof v === "string" && v.length > 0 ? v : undefined
                        }
                        onValueChange={(val) => setValue(k, val)}
                      >
                        <SelectTrigger id={inputId}>
                          <SelectValue placeholder="Select an option" />
                        </SelectTrigger>
                        <SelectContent>
                          {(f.options ?? []).map((opt) => (
                            <SelectItem key={opt} value={opt}>
                              {opt}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {t === "multi_select" && (
                      <div className="space-y-2">
                        {(f.options ?? []).length === 0 && (
                          <p className="text-xs text-muted-foreground">
                            No options configured.
                          </p>
                        )}
                        {(f.options ?? []).map((opt) => {
                          const selected = Array.isArray(v) ? v : [];
                          const checked = selected.includes(opt);
                          const optId = `${inputId}-${opt}`;
                          return (
                            <div key={opt} className="flex items-center gap-2">
                              <Checkbox
                                id={optId}
                                checked={checked}
                                onCheckedChange={(next) => {
                                  const isOn = next === true;
                                  const without = selected.filter(
                                    (s) => s !== opt
                                  );
                                  setValue(k, isOn ? [...without, opt] : without);
                                }}
                              />
                              <Label
                                htmlFor={optId}
                                className="text-sm font-normal"
                              >
                                {opt}
                              </Label>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {t === "checkbox" && (
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={inputId}
                          checked={v === true}
                          onCheckedChange={(checked) =>
                            setValue(k, checked === true)
                          }
                        />
                        <Label htmlFor={inputId} className="text-sm font-normal">
                          Yes
                        </Label>
                      </div>
                    )}
                    {t === "image" && (
                      <ScreenshotInput
                        id={inputId}
                        onFile={(file) => onFileChange(f, t, file)}
                        uploading={uploadingKey === k}
                        previewUrl={
                          filePaths[k]
                            ? signedUrls?.[filePaths[k] as string] ?? null
                            : null
                        }
                        currentFilename={
                          filePaths[k]?.split("/").pop() ?? null
                        }
                      />
                    )}
                    {t === "file" && (
                      <div className="space-y-1.5">
                        <input
                          id={inputId}
                          type="file"
                          onChange={(e) => {
                            const file = e.target.files?.[0] ?? null;
                            void onFileChange(f, t, file);
                          }}
                          disabled={uploadingKey === k}
                          className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-accent"
                        />
                        {uploadingKey === k && (
                          <p className="text-xs text-muted-foreground">
                            Uploading…
                          </p>
                        )}
                        {filePaths[k] && uploadingKey !== k && (
                          <p className="text-xs text-muted-foreground break-all">
                            Current: {filePaths[k]?.split("/").pop()}
                          </p>
                        )}
                      </div>
                    )}
                    {t === "repo" &&
                      (f.repo_url ? (
                        <RepoActions url={f.repo_url} />
                      ) : (
                        <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                          No repository has been set for this workstream yet.
                        </p>
                      ))}
                  </div>
                );
              })}
            </div>
            {f.help_text && (
              <p className="text-xs text-muted-foreground">{f.help_text}</p>
            )}
          </div>
        );
      })}

      <div className="flex flex-wrap items-center gap-2 pt-2">
        <Button onClick={onSave} disabled={isPending} variant="outline">
          {isPending
            ? isDraft
              ? "Saving…"
              : "Updating…"
            : isDraft
              ? "Save draft"
              : "Update request"}
        </Button>
        {canSubmit && (
          <Button
            onClick={() => doSubmit(false)}
            disabled={isPending || !hasTeam || !productId}
            title={
              !hasTeam
                ? "You need to be on a team before submitting"
                : !productId
                  ? "Pick a workstream before submitting"
                  : undefined
            }
          >
            {isPending ? "Submitting…" : "Submit to workstream"}
          </Button>
        )}
        {canSubmit && !hasTeam && (
          <p className="basis-full text-xs text-muted-foreground">
            You can save drafts, but submission requires you to be on a team.
            Ask an admin to add you.
          </p>
        )}
        {canSubmit && hasTeam && !productId && (
          <p className="basis-full text-xs text-muted-foreground">
            Pick a workstream to submit — its owner sets what this request needs.
          </p>
        )}
      </div>

      <Dialog
        open={softModal.open}
        onOpenChange={(open) =>
          setSoftModal((prev) => ({ ...prev, open }))
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit without these?</DialogTitle>
            <DialogDescription>
              The following fields are recommended but not filled in. You can
              still submit, but the workstream may ask for more detail.
            </DialogDescription>
          </DialogHeader>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {softModal.missing.map((m) => (
              <li key={m.id}>{m.label}</li>
            ))}
          </ul>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setSoftModal({ open: false, missing: [] })}
              disabled={isPending}
            >
              Go back
            </Button>
            <Button onClick={() => doSubmit(true)} disabled={isPending}>
              {isPending ? "Submitting…" : "Submit anyway"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={leaveModalOpen}
        onOpenChange={(open) => {
          // Closing via overlay / Esc behaves like Cancel — stay put.
          if (!open) closeLeaveModal();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save this draft?</DialogTitle>
            <DialogDescription>
              You have unsaved changes. Save them before leaving, or discard
              them and go anyway.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={closeLeaveModal}
              disabled={leaving}
            >
              Cancel
            </Button>
            <Button
              variant="ghost"
              onClick={leaveWithoutSaving}
              disabled={leaving}
            >
              Leave without saving
            </Button>
            <Button onClick={saveThenLeave} disabled={leaving}>
              {leaving ? "Saving…" : "Save draft"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
