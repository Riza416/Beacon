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
import { Checkbox } from "@/components/ui/checkbox";
import type { Product } from "@/lib/types";
import { createProduct, updateProduct } from "../actions";

interface ProductDialogProps {
  mode: "create" | "edit";
  product?: Product;
  /** All teams, for the owning-team picker. */
  teams: { id: string; name: string }[];
  /** Team ids that currently own this product (edit mode). */
  ownerTeamIds?: string[];
  trigger: React.ReactNode;
}

export function ProductDialog({
  mode,
  product,
  teams,
  ownerTeamIds = [],
  trigger,
}: ProductDialogProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [owners, setOwners] = useState<Set<string>>(
    () => new Set(ownerTeamIds)
  );

  function toggleOwner(teamId: string, on: boolean) {
    setOwners((prev) => {
      const next = new Set(prev);
      if (on) next.add(teamId);
      else next.delete(teamId);
      return next;
    });
  }

  function onSubmit(formData: FormData) {
    if (mode === "edit" && product?.id) formData.set("id", product.id);
    formData.delete("owner_team_ids");
    for (const id of owners) formData.append("owner_team_ids", id);
    startTransition(async () => {
      try {
        if (mode === "create") await createProduct(formData);
        else await updateProduct(formData);
        toast.success(mode === "create" ? "Product created" : "Product updated");
        setOpen(false);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Could not save product";
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
            {mode === "create" ? "Add product" : "Edit product"}
          </DialogTitle>
          <DialogDescription>
            Products are the catalog authors pick from when creating a request.
          </DialogDescription>
        </DialogHeader>
        <form action={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              name="name"
              defaultValue={product?.name ?? ""}
              required
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={product?.description ?? ""}
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label>Owning teams</Label>
            <p className="text-xs text-muted-foreground">
              Teams responsible for this product.
            </p>
            {teams.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No teams yet — create one under Teams first.
              </p>
            ) : (
              <div className="grid max-h-40 grid-cols-1 gap-2 overflow-auto rounded-md border p-3 sm:grid-cols-2">
                {teams.map((t) => {
                  const id = `owner-${t.id}`;
                  return (
                    <div key={t.id} className="flex items-center gap-2">
                      <Checkbox
                        id={id}
                        checked={owners.has(t.id)}
                        onCheckedChange={(c) => toggleOwner(t.id, c === true)}
                      />
                      <Label htmlFor={id} className="text-sm font-normal">
                        {t.name}
                      </Label>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : mode === "create" ? "Create" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
