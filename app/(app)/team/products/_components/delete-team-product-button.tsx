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
import { deleteProduct } from "@/app/(app)/admin/products/actions";

export function DeleteTeamProductButton({
  productId,
  productName,
}: {
  productId: string;
  productName: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function onConfirm() {
    const fd = new FormData();
    fd.set("id", productId);
    startTransition(async () => {
      try {
        await deleteProduct(fd);
        toast.success("Workstream deleted");
        setOpen(false);
        router.refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not delete";
        toast.error(message);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-destructive">
          Delete
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete workstream</DialogTitle>
          <DialogDescription>
            Delete &ldquo;{productName}&rdquo;? Any requests pointing to it will
            have their workstream cleared (set to none).
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={pending}>
            {pending ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
