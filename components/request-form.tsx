"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
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
  saveDraft,
  submitRequest,
  setFieldFile,
} from "@/app/(app)/requests/actions";
import { ScreenshotInput } from "@/components/screenshot-input";
import type { SubmitResult } from "@/lib/request-actions-types";
import type {
  FieldDefinition,
  FieldType,
  FieldValue,
  RequestRow,
} from "@/lib/types";

interface RequestFormProps {
  request: RequestRow;
  fields: FieldDefinition[];
  values: FieldValue[];
  canSubmit: boolean;
  /** Current user's id; used as the storage path prefix. */
  uploaderId: string;
  /** Signed URLs (keyed by storage path) for any existing image attachments,
   * so the form can show a preview of what's already saved. */
  signedUrls?: Record<string, string>;
}

type FormValue = string | boolean | string[];

const TYPE_CAPTIONS: Record<FieldType, string> = {
  short_text: "Short answer",
  long_text: "Detailed answer",
  url: "Link",
  file: "File",
  image: "Screenshot",
  select: "Pick one",
  multi_select: "Pick several",
  checkbox: "Yes / no",
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
  fields,
  values,
  canSubmit,
  uploaderId,
  signedUrls,
}: RequestFormProps) {
  const router = useRouter();
  const [title, setTitle] = React.useState(request.title ?? "");
  const [summary, setSummary] = React.useState(request.summary ?? "");

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

  const [isPending, startTransition] = React.useTransition();
  const [softModal, setSoftModal] = React.useState<{
    open: boolean;
    missing: { id: string; label: string }[];
  }>({ open: false, missing: [] });

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
    return { title, summary, values: valuesPayload };
  }

  function onSave() {
    startTransition(async () => {
      try {
        await saveDraft(request.id, buildFormState());
        toast.success("Draft saved");
        router.refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not save";
        toast.error(message);
      }
    });
  }

  function doSubmit(force: boolean) {
    startTransition(async () => {
      try {
        const result: SubmitResult = await submitRequest(
          request.id,
          buildFormState(),
          { force }
        );
        if (result.ok) {
          toast.success("Request submitted");
          setSoftModal({ open: false, missing: [] });
          router.push(`/requests/${request.id}`);
          router.refresh();
          return;
        }
        if (result.kind === "hard") {
          toast.error(
            `Required: ${result.missing.map((m) => m.label).join(", ")}`
          );
          return;
        }
        // soft
        setSoftModal({ open: true, missing: result.missing });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not submit";
        toast.error(message);
      }
    });
  }

  async function onFileChange(
    field: FieldDefinition,
    type: FieldType,
    file: File | null
  ) {
    if (!file) return;
    const supabase = createClient();
    const k = fieldKey(field.id, type);
    setUploadingKey(k);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${uploaderId}/${request.id}/${field.id}/${type}/${Date.now()}-${safeName}`;
      const { error } = await supabase.storage
        .from("request-attachments")
        .upload(path, file, { upsert: true });
      if (error) throw new Error(error.message);
      await setFieldFile(request.id, field.id, type, path);
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
    setFormValues((prev) => ({ ...prev, [key]: next }));
  }

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
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Untitled draft"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="summary">Summary</Label>
        <Textarea
          id="summary"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="A short description of what you're asking for."
          rows={4}
        />
      </div>

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
                    {showSubLabels && (
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
                    {t === "select" && (
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
                        currentFilename={filePaths[k]?.split("/").pop() ?? null}
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
          {isPending ? "Saving…" : "Save draft"}
        </Button>
        {canSubmit && (
          <Button onClick={() => doSubmit(false)} disabled={isPending}>
            {isPending ? "Submitting…" : "Submit to product team"}
          </Button>
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
              still submit, but the product team may ask for more detail.
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
    </div>
  );
}
