"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
  { value: "url", label: "URL" },
  { value: "file", label: "File" },
  { value: "image", label: "Image" },
  { value: "select", label: "Select (one option)" },
  { value: "multi_select", label: "Multi-select (many options)" },
  { value: "checkbox", label: "Checkbox" },
];

const TYPES_WITH_OPTIONS: FieldType[] = ["select", "multi_select"];

const REQUIRED_LEVELS: { value: RequiredLevel; label: string }[] = [
  { value: "hard", label: "Hard (must fill to submit)" },
  { value: "soft", label: "Soft (warn but allow)" },
  { value: "optional", label: "Optional" },
];

export function CreateFieldDialog() {
  const [open, setOpen] = useState(false);
  const [fieldType, setFieldType] = useState<FieldType>("short_text");
  const [requiredLevel, setRequiredLevel] = useState<RequiredLevel>("optional");
  const [isPending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    formData.set("field_type", fieldType);
    formData.set("required_level", requiredLevel);
    startTransition(async () => {
      try {
        await createField(formData);
        toast.success("Field created");
        setOpen(false);
        setFieldType("short_text");
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
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={fieldType}
                onValueChange={(v) => setFieldType(v as FieldType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
          </div>
          <div className="space-y-2">
            <Label htmlFor="help_text">Help text</Label>
            <Textarea id="help_text" name="help_text" rows={2} />
          </div>
          {TYPES_WITH_OPTIONS.includes(fieldType) && (
            <div className="space-y-2">
              <Label htmlFor="options">Options (one per line)</Label>
              <Textarea
                id="options"
                name="options"
                rows={4}
                placeholder={"Low\nMedium\nHigh"}
              />
              {fieldType === "multi_select" && (
                <p className="text-xs text-muted-foreground">
                  Users can pick more than one option.
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
