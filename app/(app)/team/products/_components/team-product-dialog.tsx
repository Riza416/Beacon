"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import type { Product } from "@/lib/types";
import { createProduct, updateProduct } from "@/app/(app)/admin/products/actions";

interface TeamProductDialogProps {
  mode: "create" | "edit";
  product?: Product;
  trigger: React.ReactNode;
}

export function TeamProductDialog({
  mode,
  product,
  trigger,
}: TeamProductDialogProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function onSubmit(formData: FormData) {
    if (mode === "edit" && product?.id) formData.set("id", product.id);
    startTransition(async () => {
      try {
        if (mode === "create") await createProduct(formData);
        else await updateProduct(formData);
        toast.success(mode === "create" ? "Workstream created" : "Workstream updated");
        setOpen(false);
        router.refresh();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Could not save workstream";
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
            {mode === "create" ? "Add workstream" : "Edit workstream"}
          </DialogTitle>
          <DialogDescription>
            Workstreams your team owns show up in the request form for authors to
            pick from.
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
