"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Eye, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RepoActions } from "@/components/repo-actions";
import type { FieldDefinition, FieldType, RequiredLevel } from "@/lib/types";
import type { TemplateRow } from "@/lib/workstream-template";
import {
  addCatalogFieldToTemplate,
  createCustomField,
  moveTemplateField,
  removeTemplateField,
  setBuiltinFieldEnabled,
  setRepoUrl,
  setTemplateFieldLevel,
} from "@/app/(app)/admin/products/template-actions";

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: "short_text", label: "Short text" },
  { value: "long_text", label: "Long text" },
  { value: "prd", label: "Product requirements document" },
  { value: "url", label: "URL" },
  { value: "file", label: "File" },
  { value: "image", label: "Image" },
  { value: "select", label: "Select" },
  { value: "multi_select", label: "Multi-select" },
  { value: "checkbox", label: "Checkbox" },
  { value: "repo", label: "Repo link" },
];

const TYPE_LABELS: Record<FieldType, string> = Object.fromEntries(
  FIELD_TYPES.map((t) => [t.value, t.label])
) as Record<FieldType, string>;

const TYPES_WITH_OPTIONS: FieldType[] = ["select", "multi_select"];

const REQUIRED_LEVELS: { value: RequiredLevel; label: string }[] = [
  { value: "hard", label: "Hard" },
  { value: "soft", label: "Soft" },
  { value: "optional", label: "Optional" },
];

function humanizeTypes(types: FieldType[]): string {
  return types.map((t) => TYPE_LABELS[t] ?? t).join(", ");
}

export interface BuiltinVisibility {
  deadline: boolean;
  dependentTeams: boolean;
}

interface WorkstreamTemplateEditorProps {
  productId: string;
  productName: string;
  template: TemplateRow[]; // already ordered by display_order
  addableCatalog: FieldDefinition[]; // shared catalog fields NOT yet in this template
  builtins: BuiltinVisibility;
}

export function WorkstreamTemplateEditor({
  productId,
  productName,
  template,
  addableCatalog,
  builtins,
}: WorkstreamTemplateEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedCatalogId, setSelectedCatalogId] = useState("");

  function runAction(fn: () => Promise<void>, successMessage: string) {
    startTransition(async () => {
      try {
        await fn();
        toast.success(successMessage);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  function onSetLevel(fieldId: string, level: RequiredLevel) {
    runAction(
      () => setTemplateFieldLevel(productId, fieldId, level),
      "Requirement level updated"
    );
  }

  function onMove(fieldId: string, direction: "up" | "down") {
    runAction(
      () => moveTemplateField(productId, fieldId, direction),
      "Field reordered"
    );
  }

  function onRemove(row: TemplateRow) {
    if (row.isCustom) {
      const ok = window.confirm(
        `Remove "${row.field.label}"? This is a custom field — removing it retires the field for this workstream.`
      );
      if (!ok) return;
    }
    runAction(
      () => removeTemplateField(productId, row.field.id),
      "Field removed"
    );
  }

  function onToggleBuiltin(
    field: "deadline" | "dependent_teams",
    enabled: boolean
  ) {
    runAction(
      () => setBuiltinFieldEnabled(productId, field, enabled),
      enabled ? "Field added to template" : "Field removed"
    );
  }

  function onSaveRepoUrl(fieldId: string, url: string) {
    runAction(() => setRepoUrl(productId, fieldId, url), "Repo link saved");
  }

  function onAddFromCatalog() {
    if (!selectedCatalogId) {
      toast.error("Pick a field to add");
      return;
    }
    runAction(async () => {
      await addCatalogFieldToTemplate(productId, selectedCatalogId);
      setSelectedCatalogId("");
    }, "Field added to template");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">
            Request template — {productName}
          </h2>
          <p className="text-sm text-muted-foreground">
            These fields, and their requirement levels, are what authors fill in
            when they pick this workstream.
          </p>
        </div>
        <TemplatePreviewDialog
          productName={productName}
          template={template}
          builtins={builtins}
        />
      </div>

      <div className="space-y-2">
        <div>
          <h3 className="text-sm font-semibold">Built-in fields</h3>
          <p className="text-xs text-muted-foreground">
            Always part of every request. Title and Summary can&apos;t be
            removed; Deadline and Dependent teams are optional per workstream.
          </p>
        </div>
        <ul className="divide-y rounded-md border">
          <BuiltinRow label="Title" note="Always shown" />
          <BuiltinRow label="Summary" note="Always shown · required" />
          <BuiltinRow
            label="Deadline"
            enabled={builtins.deadline}
            isPending={isPending}
            onToggle={(on) => onToggleBuiltin("deadline", on)}
          />
          <BuiltinRow
            label="Dependent teams"
            enabled={builtins.dependentTeams}
            isPending={isPending}
            onToggle={(on) => onToggleBuiltin("dependent_teams", on)}
          />
        </ul>
      </div>

      <div>
        <h3 className="text-sm font-semibold">
          Custom &amp; catalog fields
        </h3>
        <p className="mb-2 text-xs text-muted-foreground">
          The workstream-specific questions authors answer, in order.
        </p>
      </div>

      {template.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="text-sm font-medium">No fields yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add a field from the shared catalog or create a custom field to
            start building this workstream&apos;s request template.
          </p>
        </div>
      ) : (
        <ul className="divide-y rounded-md border">
          {template.map((row, idx) => {
            const isFirst = idx === 0;
            const isLast = idx === template.length - 1;
            return (
              <li key={row.field.id} className="flex flex-col gap-3 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{row.field.label}</span>
                    {row.isCustom && <Badge variant="secondary">Custom</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {humanizeTypes(row.field.field_types)}
                  </p>
                </div>

                <div className="flex flex-shrink-0 items-center gap-2">
                  <Select
                    value={row.required_level}
                    onValueChange={(v) =>
                      onSetLevel(row.field.id, v as RequiredLevel)
                    }
                    disabled={isPending}
                  >
                    <SelectTrigger className="w-[130px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REQUIRED_LEVELS.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Move up"
                    disabled={isPending || isFirst}
                    onClick={() => onMove(row.field.id, "up")}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Move down"
                    disabled={isPending || isLast}
                    onClick={() => onMove(row.field.id, "down")}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    disabled={isPending}
                    onClick={() => onRemove(row)}
                  >
                    <Trash2 className="mr-1 h-4 w-4" />
                    Remove
                  </Button>
                </div>
                </div>
                {row.field.field_types.includes("repo") && (
                  <RepoUrlField
                    initial={row.repoUrl}
                    isPending={isPending}
                    onSave={(url) => onSaveRepoUrl(row.field.id, url)}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-col gap-4 border-t pt-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Label>Add from catalog</Label>
          {addableCatalog.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Every shared catalog field is already in this template.
            </p>
          ) : (
            <div className="flex items-center gap-2">
              <Select
                value={selectedCatalogId}
                onValueChange={setSelectedCatalogId}
                disabled={isPending}
              >
                <SelectTrigger className="w-[240px]">
                  <SelectValue placeholder="Choose a field…" />
                </SelectTrigger>
                <SelectContent>
                  {addableCatalog.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                disabled={isPending || !selectedCatalogId}
                onClick={onAddFromCatalog}
              >
                Add
              </Button>
            </div>
          )}
        </div>

        <CreateCustomFieldDialog
          productId={productId}
          isPending={isPending}
          runAction={runAction}
        />
      </div>
    </div>
  );
}

function BuiltinRow({
  label,
  note,
  enabled,
  isPending,
  onToggle,
}: {
  label: string;
  /** Shown for non-removable rows (Title / Summary). */
  note?: string;
  /** Present only for toggleable rows. */
  enabled?: boolean;
  isPending?: boolean;
  onToggle?: (enabled: boolean) => void;
}) {
  const toggleable = onToggle !== undefined;
  return (
    <li className="flex items-center justify-between gap-3 p-4">
      <div className="flex items-center gap-2">
        <span className="font-medium">{label}</span>
        {toggleable && !enabled && <Badge variant="outline">Removed</Badge>}
      </div>
      {toggleable ? (
        enabled ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive"
            disabled={isPending}
            onClick={() => onToggle(false)}
          >
            <Trash2 className="mr-1 h-4 w-4" />
            Remove
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => onToggle(true)}
          >
            Add back
          </Button>
        )
      ) : (
        <span className="text-xs text-muted-foreground">{note}</span>
      )}
    </li>
  );
}

function RepoUrlField({
  initial,
  isPending,
  onSave,
}: {
  initial: string | null;
  isPending: boolean;
  onSave: (url: string) => void;
}) {
  const [value, setValue] = useState(initial ?? "");
  const dirty = value.trim() !== (initial ?? "").trim();
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <Label htmlFor="repo-url" className="text-xs font-medium">
        Repo link
      </Label>
      <p className="mb-2 text-xs text-muted-foreground">
        Authors see this repository with buttons to request access and branch
        off. GitHub and GitLab links are auto-detected.
      </p>
      <div className="flex items-center gap-2">
        <Input
          id="repo-url"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="https://github.com/org/repo"
          disabled={isPending}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending || !dirty}
          onClick={() => onSave(value)}
        >
          Save
        </Button>
      </div>
    </div>
  );
}

interface CreateCustomFieldDialogProps {
  productId: string;
  isPending: boolean;
  runAction: (fn: () => Promise<void>, successMessage: string) => void;
}

function CreateCustomFieldDialog({
  productId,
  isPending,
  runAction,
}: CreateCustomFieldDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState<Set<FieldType>>(
    () => new Set<FieldType>(["short_text"])
  );
  const [requiredLevel, setRequiredLevel] = useState<RequiredLevel>("optional");

  const showOptions = TYPES_WITH_OPTIONS.some((t) => selectedTypes.has(t));

  function toggleType(t: FieldType, on: boolean) {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (on) next.add(t);
      else next.delete(t);
      return next;
    });
  }

  function onSubmit(formData: FormData) {
    const label = String(formData.get("label") ?? "").trim();
    if (!label) {
      toast.error("Label required");
      return;
    }
    if (selectedTypes.size === 0) {
      toast.error("Pick at least one type");
      return;
    }
    formData.delete("field_types");
    for (const t of selectedTypes) formData.append("field_types", t);
    formData.set("required_level", requiredLevel);

    runAction(async () => {
      await createCustomField(productId, formData);
      setOpen(false);
      setSelectedTypes(new Set<FieldType>(["short_text"]));
      setRequiredLevel("optional");
    }, "Custom field created");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button">Create custom field</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create custom field</DialogTitle>
          <DialogDescription>
            A custom field belongs only to this workstream and is added to the
            end of its request template.
          </DialogDescription>
        </DialogHeader>
        <form action={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="custom-label">Label</Label>
            <Input id="custom-label" name="label" required autoFocus />
          </div>
          <div className="space-y-2">
            <Label>Types</Label>
            <p className="text-xs text-muted-foreground">
              Tick every input type the author can fill for this field. The form
              renders one sub-input per ticked type.
            </p>
            <div className="grid grid-cols-2 gap-2 rounded-md border p-3">
              {FIELD_TYPES.map((t) => {
                const id = `custom-type-${t.value}`;
                const checked = selectedTypes.has(t.value);
                return (
                  <div key={t.value} className="flex items-center gap-2">
                    <Checkbox
                      id={id}
                      checked={checked}
                      onCheckedChange={(next) =>
                        toggleType(t.value, next === true)
                      }
                    />
                    <Label htmlFor={id} className="text-sm font-normal">
                      {t.label}
                    </Label>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Required level</Label>
            <Select
              value={requiredLevel}
              onValueChange={(v) => setRequiredLevel(v as RequiredLevel)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REQUIRED_LEVELS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="custom-help_text">Help text</Label>
            <Textarea id="custom-help_text" name="help_text" rows={2} />
          </div>
          {showOptions && (
            <div className="space-y-2">
              <Label htmlFor="custom-options">Options (one per line)</Label>
              <Textarea
                id="custom-options"
                name="options"
                rows={4}
                placeholder={"Low\nMedium\nHigh"}
              />
              {selectedTypes.has("multi_select") && (
                <p className="text-xs text-muted-foreground">
                  Authors can pick more than one option in multi-select.
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Draft preview — renders the request form exactly as an author would see it
// for the CURRENT template (built-in Title/Summary + each template field with
// its label, requirement marker, and input controls). Read-only: every control
// is disabled, so this is a faithful mock, not a working form.
// ---------------------------------------------------------------------------

function RequiredMark({ level }: { level: RequiredLevel }) {
  if (level === "hard") return <span className="ml-1 text-destructive">*</span>;
  if (level === "soft")
    return <span className="ml-1 text-muted-foreground">·</span>;
  return null;
}

function TemplatePreviewDialog({
  productName,
  template,
  builtins,
}: {
  productName: string;
  template: TemplateRow[];
  builtins: BuiltinVisibility;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="flex-shrink-0">
          <Eye className="mr-1 h-4 w-4" />
          Show draft
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Request form preview</DialogTitle>
          <DialogDescription>
            How the {productName} request form looks to authors right now.
            Read-only — a red asterisk means required to submit, a dot means
            recommended.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <div className="space-y-2">
            <Label className="flex items-center">Title</Label>
            <Input disabled placeholder="Untitled draft" />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center">
              Summary
              <span className="ml-1 text-destructive">*</span>
            </Label>
            <Textarea
              disabled
              rows={3}
              placeholder="A short description of what you're asking for."
            />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center">
              Workstream
              <span className="ml-1 text-destructive">*</span>
            </Label>
            <Select disabled>
              <SelectTrigger>
                <SelectValue placeholder={productName} />
              </SelectTrigger>
            </Select>
          </div>
          {builtins.deadline && (
            <div className="space-y-2">
              <Label>Deadline</Label>
              <Input type="date" disabled className="w-fit" />
              <p className="text-xs text-muted-foreground">
                Optional. When does this need to be done by?
              </p>
            </div>
          )}
          {builtins.dependentTeams && (
            <div className="space-y-2">
              <Label>Dependent teams</Label>
              <Select disabled>
                <SelectTrigger>
                  <SelectValue placeholder="Add a team…" />
                </SelectTrigger>
              </Select>
              <p className="text-xs text-muted-foreground">
                Optional. Tag other teams this request depends on.
              </p>
            </div>
          )}

          {template.length === 0 ? (
            <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              No custom fields yet — authors would only see the fields above.
            </p>
          ) : (
            template.map((row) => (
              <PreviewTemplateField key={row.field.id} row={row} />
            ))
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PreviewTemplateField({ row }: { row: TemplateRow }) {
  const f = row.field;
  const types =
    f.field_types && f.field_types.length > 0 ? f.field_types : [f.field_type];
  const showSubLabels = types.length > 1;
  return (
    <div className="space-y-2">
      <Label className="flex items-center">
        <span>{f.label}</span>
        <RequiredMark level={row.required_level} />
      </Label>
      <div className="space-y-3">
        {types.map((t) => (
          <div key={t} className="space-y-1.5">
            {showSubLabels && (
              <p className="text-xs font-normal text-muted-foreground">
                {TYPE_LABELS[t]}
              </p>
            )}
            <PreviewInput
              type={t}
              options={f.options ?? []}
              repoUrl={row.repoUrl}
            />
          </div>
        ))}
      </div>
      {f.help_text && (
        <p className="text-xs text-muted-foreground">{f.help_text}</p>
      )}
    </div>
  );
}

function PreviewInput({
  type,
  options,
  repoUrl,
}: {
  type: FieldType;
  options: string[];
  repoUrl?: string | null;
}) {
  switch (type) {
    case "short_text":
      return <Input disabled />;
    case "long_text":
    case "prd":
      return <Textarea disabled rows={4} />;
    case "url":
      return <Input disabled type="url" placeholder="https://" />;
    case "select":
      return (
        <Select disabled>
          <SelectTrigger>
            <SelectValue placeholder="Select an option" />
          </SelectTrigger>
        </Select>
      );
    case "multi_select":
      return options.length === 0 ? (
        <p className="text-xs text-muted-foreground">No options configured.</p>
      ) : (
        <div className="space-y-2">
          {options.map((opt) => (
            <div key={opt} className="flex items-center gap-2">
              <Checkbox disabled />
              <Label className="text-sm font-normal text-muted-foreground">
                {opt}
              </Label>
            </div>
          ))}
        </div>
      );
    case "checkbox":
      return (
        <div className="flex items-center gap-2">
          <Checkbox disabled />
          <Label className="text-sm font-normal text-muted-foreground">Yes</Label>
        </div>
      );
    case "image":
      return (
        <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
          Paste or upload a screenshot
        </div>
      );
    case "file":
      return (
        <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
          File upload
        </div>
      );
    case "repo":
      return repoUrl ? (
        <RepoActions url={repoUrl} preview />
      ) : (
        <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
          No repo link set yet — add one on this field above.
        </p>
      );
    default:
      return null;
  }
}
