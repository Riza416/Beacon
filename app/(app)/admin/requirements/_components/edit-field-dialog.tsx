"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FieldDefinition, FieldType, RequiredLevel } from "@/lib/types";
import { updateField } from "../actions";

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

const TYPES_WITH_OPTIONS: FieldType[] = ["select", "multi_select"];

const REQUIRED_LEVELS: { value: RequiredLevel; label: string }[] = [
  { value: "hard", label: "Hard (must fill to submit)" },
  { value: "soft", label: "Soft (warn but allow)" },
  { value: "optional", label: "Optional" },
];

interface EditFieldDialogProps {
  field: FieldDefinition;
}

function initialTypes(field: FieldDefinition): Set<FieldType> {
  const list =
    field.field_types && field.field_types.length > 0
      ? field.field_types
      : [field.field_type];
  return new Set<FieldType>(list);
}

export function EditFieldDialog({ field }: EditFieldDialogProps) {
  const [open, setOpen] = useState(false);
  const [requiredLevel, setRequiredLevel] = useState<RequiredLevel>(
    field.required_level
  );
  const [selectedTypes, setSelectedTypes] = useState<Set<FieldType>>(() =>
    initialTypes(field)
  );
  const [isPending, startTransition] = useTransition();

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
    if (selectedTypes.size === 0) {
      toast.error("Pick at least one type");
      return;
    }
    formData.set("required_level", requiredLevel);
    formData.delete("field_types");
    for (const t of selectedTypes) formData.append("field_types", t);
    // NOTE: removing a type from the set leaves any previously-stored
    // request_field_values rows for that type orphaned in the DB on purpose —
    // the form just stops rendering them, but the detail page still surfaces
    // them as "legacy" so nothing disappears silently.
    startTransition(async () => {
      try {
        await updateField(formData);
        toast.success("Field updated");
        setOpen(false);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to update field";
        toast.error(message);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit field</DialogTitle>
          <DialogDescription>
            Add or remove allowed input types. Removing a type does not delete
            previously-collected answers — the request form just stops asking
            for it.
          </DialogDescription>
        </DialogHeader>
        <form action={onSubmit} className="space-y-4">
          <input type="hidden" name="id" value={field.id} />
          <div className="space-y-2">
            <Label htmlFor={`label-${field.id}`}>Label</Label>
            <Input
              id={`label-${field.id}`}
              name="label"
              defaultValue={field.label}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Types</Label>
            <div className="grid grid-cols-2 gap-2 rounded-md border p-3">
              {FIELD_TYPES.map((t) => {
                const id = `edit-${field.id}-type-${t.value}`;
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
            <Label htmlFor={`help-${field.id}`}>Help text</Label>
            <Textarea
              id={`help-${field.id}`}
              name="help_text"
              rows={2}
              defaultValue={field.help_text ?? ""}
            />
          </div>
          {showOptions && (
            <div className="space-y-2">
              <Label htmlFor={`options-${field.id}`}>Options (one per line)</Label>
              <Textarea
                id={`options-${field.id}`}
                name="options"
                rows={4}
                defaultValue={(field.options ?? []).join("\n")}
              />
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
