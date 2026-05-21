"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp } from "lucide-react";
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
import { deleteStatus, moveStatus } from "../actions";

interface StatusRowActionsProps {
  statusId: string;
  statusLabel: string;
  isFirst: boolean;
  isLast: boolean;
}

export function StatusRowActions({
  statusId,
  statusLabel,
  isFirst,
  isLast,
}: StatusRowActionsProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function move(direction: "up" | "down") {
    const fd = new FormData();
    fd.set("id", statusId);
    fd.set("direction", direction);
    startTransition(async () => {
      try {
        await moveStatus(fd);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to reorder";
        toast.error(message);
      }
    });
  }

  function onDelete() {
    const fd = new FormData();
    fd.set("id", statusId);
    startTransition(async () => {
      try {
        await deleteStatus(fd);
        toast.success("Status deleted");
        setConfirmOpen(false);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to delete status";
        toast.error(message);
      }
    });
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        variant="ghost"
        size="icon"
        disabled={isFirst || isPending}
        onClick={() => move("up")}
        aria-label="Move up"
      >
        <ArrowUp className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        disabled={isLast || isPending}
        onClick={() => move("down")}
        aria-label="Move down"
      >
        <ArrowDown className="h-4 w-4" />
      </Button>
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className="text-destructive">
            Delete
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete status</DialogTitle>
            <DialogDescription>
              Delete &ldquo;{statusLabel}&rdquo;? Requests currently assigned to it
              will lose their status.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={onDelete} disabled={isPending}>
              {isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
