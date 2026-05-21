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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  deleteStatus,
  mergeAndDeleteStatus,
  moveStatus,
} from "../actions";

interface StatusRowActionsProps {
  statusId: string;
  statusLabel: string;
  usageCount: number;
  otherStatuses: { id: string; label: string }[];
  isFirst: boolean;
  isLast: boolean;
}

const UNASSIGN_VALUE = "__unassigned__";

export function StatusRowActions({
  statusId,
  statusLabel,
  usageCount,
  otherStatuses,
  isFirst,
  isLast,
}: StatusRowActionsProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [mergeTarget, setMergeTarget] = useState<string>(
    otherStatuses[0]?.id ?? UNASSIGN_VALUE
  );
  const [isPending, startTransition] = useTransition();

  const inUse = usageCount > 0;

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

  function onConfirm() {
    startTransition(async () => {
      try {
        if (inUse) {
          const fd = new FormData();
          fd.set("from_id", statusId);
          fd.set(
            "into_id",
            mergeTarget === UNASSIGN_VALUE ? "" : mergeTarget
          );
          await mergeAndDeleteStatus(fd);
          toast.success(
            mergeTarget === UNASSIGN_VALUE
              ? "Status removed; requests are now unassigned"
              : "Status merged"
          );
        } else {
          const fd = new FormData();
          fd.set("id", statusId);
          await deleteStatus(fd);
          toast.success("Status deleted");
        }
        setConfirmOpen(false);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to delete status";
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
            <DialogTitle>
              {inUse ? "Merge & delete status" : "Delete status"}
            </DialogTitle>
            <DialogDescription>
              {inUse ? (
                <>
                  &ldquo;{statusLabel}&rdquo; is currently assigned to{" "}
                  <strong>
                    {usageCount} {usageCount === 1 ? "request" : "requests"}
                  </strong>
                  . Pick a status to move them to before deleting.
                </>
              ) : (
                <>
                  Delete &ldquo;{statusLabel}&rdquo;? It&apos;s not in use, so
                  no requests are affected.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {inUse && (
            <div className="space-y-2 pt-2">
              <Label>Move affected requests to</Label>
              <Select value={mergeTarget} onValueChange={setMergeTarget}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {otherStatuses.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.label}
                    </SelectItem>
                  ))}
                  <SelectItem value={UNASSIGN_VALUE}>
                    Leave unassigned
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={onConfirm}
              disabled={isPending}
            >
              {isPending
                ? "Working…"
                : inUse
                  ? "Merge & delete"
                  : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
