"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { inviteUserToTeam } from "@/app/(app)/team/actions";

interface Candidate {
  id: string;
  full_name: string | null;
  email: string | null;
}

interface AddMemberDialogProps {
  teamId: string;
  candidates: Candidate[];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AddMemberDialog({ teamId, candidates }: AddMemberDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [invited, setInvited] = useState<{
    email: string;
    tempPassword: string;
  } | null>(null);

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

  const trimmed = query.trim();
  const isEmail = EMAIL_RE.test(trimmed);
  const exactExists = candidates.some(
    (c) => (c.email ?? "").toLowerCase() === trimmed.toLowerCase()
  );
  // Offer to invite when the typed value is an email nobody here matches yet.
  const canInvite = isEmail && !exactExists;

  function addMember(profileId: string) {
    setPendingId(profileId);
    const formData = new FormData();
    formData.set("teamId", teamId);
    formData.set("profileId", profileId);
    startTransition(async () => {
      try {
        await addMemberToTeam(formData);
        toast.success("Member added");
        router.refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to add member";
        toast.error(message);
      } finally {
        setPendingId(null);
      }
    });
  }

  function invite() {
    startTransition(async () => {
      try {
        const res = await inviteUserToTeam(teamId, trimmed);
        setInvited({ email: res.email, tempPassword: res.tempPassword });
        setQuery("");
        toast.success("Account created and added to the team");
        router.refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not invite";
        toast.error(message);
      }
    });
  }

  function reset() {
    setInvited(null);
    setQuery("");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">+ Add member</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add member</DialogTitle>
          <DialogDescription>
            Assign an existing person, or type a new email to invite them.
          </DialogDescription>
        </DialogHeader>

        {invited ? (
          <div className="space-y-3">
            <p className="text-sm">
              Created <span className="font-medium">{invited.email}</span> and
              added them to this team. Share this one-time password — they
              should change it after signing in.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-md border bg-muted px-3 py-2 font-mono text-sm">
                {invited.tempPassword}
              </code>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  navigator.clipboard?.writeText(invited.tempPassword);
                  toast.success("Copied");
                }}
              >
                Copy
              </Button>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setInvited(null)}>
                Invite another
              </Button>
              <Button onClick={() => setOpen(false)}>Done</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <Input
              placeholder="Search a name, or type an email to invite…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            <div className="max-h-72 space-y-1 overflow-auto rounded-md border">
              {filtered.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  {canInvite
                    ? "No existing user — invite them below."
                    : "No one to add."}
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
                      <div className="font-medium">
                        {c.full_name || "Unnamed"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {c.email}
                      </div>
                    </div>
                    {pendingId === c.id && (
                      <span className="text-xs text-muted-foreground">
                        Adding...
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
            {canInvite && (
              <Button
                type="button"
                className="w-full"
                disabled={isPending}
                onClick={invite}
              >
                {isPending ? "Inviting…" : `Invite ${trimmed}`}
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
