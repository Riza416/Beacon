"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { addMemberToTeam } from "../actions";

interface Candidate {
  id: string;
  full_name: string | null;
  email: string | null;
}

interface AddMemberDialogProps {
  teamId: string;
  candidates: Candidate[];
}

export function AddMemberDialog({ teamId, candidates }: AddMemberDialogProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((c) => {
      return (
        (c.full_name ?? "").toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q)
      );
    });
  }, [candidates, query]);

  function addMember(profileId: string) {
    setPendingId(profileId);
    const formData = new FormData();
    formData.set("teamId", teamId);
    formData.set("profileId", profileId);
    startTransition(async () => {
      try {
        await addMemberToTeam(formData);
        toast.success("Member added");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to add member";
        toast.error(message);
      } finally {
        setPendingId(null);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">+ Add member</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add member</DialogTitle>
          <DialogDescription>
            People without a team or on a different team. Click to assign.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            placeholder="Search by name or email..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <div className="max-h-72 space-y-1 overflow-auto rounded-md border">
            {filtered.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No one to add.
              </div>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  disabled={isPending}
                  onClick={() => addMember(c.id)}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent disabled:opacity-50"
                >
                  <div>
                    <div className="font-medium">{c.full_name || "Unnamed"}</div>
                    <div className="text-xs text-muted-foreground">{c.email}</div>
                  </div>
                  {pendingId === c.id && (
                    <span className="text-xs text-muted-foreground">Adding...</span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
