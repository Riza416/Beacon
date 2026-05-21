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
import type { FieldDefinition, RequiredLevel } from "@/lib/types";
import { updateField } from "../actions";

const REQUIRED_LEVELS: { value: RequiredLevel; label: string }[] = [
  { value: "hard", label: "Hard (must fill to submit)" },
  { value: "soft", label: "Soft (warn but allow)" },
  { value: "optional", label: "Optional" },
];

interface EditFieldDialogProps {
  field: FieldDefinition;
}

export function EditFieldDialog({ field }: EditFieldDialogProps) {
  const [open, setOpen] = useState(false);
  const [requiredLevel, setRequiredLevel] = useState<RequiredLevel>(
    field.required_level
  );
  const [isPending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    formData.set("required_level", requiredLevel);
    formData.set("field_type", field.field_type);
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
            Type cannot be changed after creation.
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
            <Label>Type</Label>
            <Input value={field.field_type} disabled readOnly />
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
          {field.field_type === "select" && (
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
