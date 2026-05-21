"use client";

import { useState, useTransition, type ReactNode } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import type { Status } from "@/lib/types";
import { createStatus, updateStatus } from "../actions";

interface StatusDialogProps {
  mode: "create" | "edit";
  status?: Status;
  trigger: ReactNode;
}

export function StatusDialog({ mode, status, trigger }: StatusDialogProps) {
  const [open, setOpen] = useState(false);
  const [color, setColor] = useState(status?.color ?? "#64748b");
  const [isDefault, setIsDefault] = useState<boolean>(status?.is_default ?? false);
  const [isTerminal, setIsTerminal] = useState<boolean>(status?.is_terminal ?? false);
  const [isPending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    formData.set("color", color);
    formData.set("is_default", String(isDefault));
    formData.set("is_terminal", String(isTerminal));
    if (mode === "edit" && status) formData.set("id", status.id);
    startTransition(async () => {
      try {
        if (mode === "create") {
          await createStatus(formData);
          toast.success("Status created");
        } else {
          await updateStatus(formData);
          toast.success("Status updated");
        }
        setOpen(false);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to save status";
        toast.error(message);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Add status" : "Edit status"}
          </DialogTitle>
          <DialogDescription>
            Statuses describe where a request is in its lifecycle.
          </DialogDescription>
        </DialogHeader>
        <form action={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`label-${status?.id ?? "new"}`}>Label</Label>
            <Input
              id={`label-${status?.id ?? "new"}`}
              name="label"
              defaultValue={status?.label}
              required
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`color-${status?.id ?? "new"}`}>Color</Label>
            <div className="flex items-center gap-3">
              <input
                id={`color-${status?.id ?? "new"}`}
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-10 w-16 cursor-pointer rounded-md border border-input bg-background"
              />
              <Input
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="font-mono"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={isDefault}
                onCheckedChange={(v) => setIsDefault(v === true)}
              />
              Default status for new requests
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={isTerminal}
                onCheckedChange={(v) => setIsTerminal(v === true)}
              />
              Terminal (request is closed)
            </label>
          </div>
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
