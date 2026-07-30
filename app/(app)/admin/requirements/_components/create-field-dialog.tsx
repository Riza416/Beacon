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
import type { FieldType, RequiredLevel } from "@/lib/types";
import { createField } from "../actions";

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

export function CreateFieldDialog() {
  const [open, setOpen] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState<Set<FieldType>>(
    () => new Set<FieldType>(["short_text"])
  );
  const [requiredLevel, setRequiredLevel] = useState<RequiredLevel>("optional");
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
    formData.delete("field_types");
    for (const t of selectedTypes) formData.append("field_types", t);
    formData.set("required_level", requiredLevel);
    startTransition(async () => {
      try {
        await createField(formData);
        toast.success("Field created");
        setOpen(false);
        setSelectedTypes(new Set<FieldType>(["short_text"]));
        setRequiredLevel("optional");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to create field";
        toast.error(message);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Add field</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add request field</DialogTitle>
          <DialogDescription>
            Define a new field that appears on the request form.
          </DialogDescription>
        </DialogHeader>
        <form action={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="label">Label</Label>
            <Input id="label" name="label" required autoFocus />
          </div>
          <div className="space-y-2">
            <Label>Types</Label>
            <p className="text-xs text-muted-foreground">
              Tick every input type the user can fill for this field. The form
              renders one sub-input per ticked type.
            </p>
            <div className="grid grid-cols-2 gap-2 rounded-md border p-3">
              {FIELD_TYPES.map((t) => {
                const id = `create-type-${t.value}`;
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
            <Label htmlFor="help_text">Help text</Label>
            <Textarea id="help_text" name="help_text" rows={2} />
          </div>
          {showOptions && (
            <div className="space-y-2">
              <Label htmlFor="options">Options (one per line)</Label>
              <Textarea
                id="options"
                name="options"
                rows={4}
                placeholder={"Low\nMedium\nHigh"}
              />
              {selectedTypes.has("multi_select") && (
                <p className="text-xs text-muted-foreground">
                  Users can pick more than one option in multi-select.
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
