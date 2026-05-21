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
import { deleteTeam } from "../actions";

interface DeleteTeamButtonProps {
  teamId: string;
  teamName: string;
}

export function DeleteTeamButton({ teamId, teamName }: DeleteTeamButtonProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function onConfirm() {
    const formData = new FormData();
    formData.set("id", teamId);
    startTransition(async () => {
      try {
        await deleteTeam(formData);
        toast.success("Team deleted");
        // server action redirects; no need to close
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to delete team";
        // Next.js redirect throws a special signal — ignore it
        if (message === "NEXT_REDIRECT") return;
        toast.error(message);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive">Delete team</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete team</DialogTitle>
          <DialogDescription>
            Delete &ldquo;{teamName}&rdquo;? Members will keep their accounts but lose
            their team assignment.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isPending}>
            {isPending ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
