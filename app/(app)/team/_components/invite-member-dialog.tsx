"use client";

import { useState, useTransition } from "react";
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
import { Label } from "@/components/ui/label";
import { inviteUserToTeam } from "@/app/(app)/team/actions";

interface InviteMemberDialogProps {
  teamId: string;
}

interface Invited {
  email: string;
  tempPassword: string;
}

export function InviteMemberDialog({ teamId }: InviteMemberDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [invited, setInvited] = useState<Invited | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  function reset() {
    setEmail("");
    setInvited(null);
    setCopied(false);
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = email.trim();
    if (!value) return;
    startTransition(async () => {
      try {
        const result = await inviteUserToTeam(teamId, value);
        setInvited({ email: result.email, tempPassword: result.tempPassword });
        toast.success("Account created");
        router.refresh();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to invite member";
        toast.error(message);
      }
    });
  }

  async function copyPassword() {
    if (!invited) return;
    try {
      await navigator.clipboard.writeText(invited.tempPassword);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy. Select and copy it manually.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>Invite member</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite member</DialogTitle>
          <DialogDescription>
            Creates a confirmed account and adds it to your team. You&apos;ll
            get a one-time temporary password to share.
          </DialogDescription>
        </DialogHeader>

        {invited ? (
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Account</Label>
              <p className="text-sm text-muted-foreground">{invited.email}</p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="temp-password">Temporary password</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="temp-password"
                  readOnly
                  value={invited.tempPassword}
                  className="font-mono"
                  onFocus={(e) => e.currentTarget.select()}
                />
                <Button type="button" variant="outline" onClick={copyPassword}>
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Share this password with {invited.email} now — it&apos;s shown
                only once and can&apos;t be recovered. Ask them to change it
                after signing in.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={reset}>
                Invite another
              </Button>
              <Button type="button" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                required
                placeholder="person@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={isPending || !email.trim()}>
                {isPending ? "Creating..." : "Create account"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
