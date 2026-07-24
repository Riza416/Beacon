"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  deleteRequest,
  updateRequestStatus,
} from "@/app/(app)/requests/actions";
import type { Status } from "@/lib/types";

interface AdminControlsProps {
  requestId: string;
  statuses: Status[];
  currentStatusId: string | null;
}

export function AdminControls({
  requestId,
  statuses,
  currentStatusId,
}: AdminControlsProps) {
  const router = useRouter();
  const [statusId, setStatusId] = React.useState<string>(currentStatusId ?? "");
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [confirmText, setConfirmText] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const confirmReady = confirmText.trim().toUpperCase() === "DELETE";

  // When moving to a terminal status we collect an optional reason (shared with
  // the requester) before committing — e.g. why something is "Won't do".
  const [reasonOpen, setReasonOpen] = React.useState(false);
  const [reasonText, setReasonText] = React.useState("");
  const [pendingStatusId, setPendingStatusId] = React.useState<string | null>(
    null
  );
  const pendingStatus = statuses.find((s) => s.id === pendingStatusId) ?? null;

  function commitStatus(next: string, reason: string | null) {
    const prev = statusId;
    setStatusId(next);
    startTransition(async () => {
      try {
        await updateRequestStatus(requestId, next, reason);
        toast.success("Status updated — the requester was notified");
        setReasonOpen(false);
        setReasonText("");
        setPendingStatusId(null);
        router.refresh();
      } catch (err) {
        setStatusId(prev);
        const message =
          err instanceof Error ? err.message : "Could not update status";
        toast.error(message);
      }
    });
  }

  function onChangeStatus(next: string) {
    if (next === statusId) return;
    const target = statuses.find((s) => s.id === next);
    // Terminal statuses open the reason dialog first; others commit directly.
    if (target?.is_terminal) {
      setPendingStatusId(next);
      setReasonText("");
      setReasonOpen(true);
      return;
    }
    commitStatus(next, null);
  }

  function onDelete() {
    startTransition(async () => {
      try {
        await deleteRequest(requestId);
        // deleteRequest redirects on success, so we won't reach here.
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Could not delete";
        // Server-action redirects throw NEXT_REDIRECT — that's not an error.
        if (message.includes("NEXT_REDIRECT")) return;
        toast.error(message);
      }
    });
  }

  return (
    <Card className="border-amber-300/60">
      <CardHeader>
        <CardTitle>Admin controls</CardTitle>
        <CardDescription>
          Triage status or remove this request.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Status</Label>
          <Select
            value={statusId || undefined}
            onValueChange={onChangeStatus}
            disabled={pending}
          >
            <SelectTrigger>
              <SelectValue placeholder="Unassigned" />
            </SelectTrigger>
            <SelectContent>
              {statuses.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="pt-2">
          <Button
            variant="destructive"
            onClick={() => setConfirmOpen(true)}
            disabled={pending}
          >
            Delete request
          </Button>
        </div>
      </CardContent>

      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          setConfirmOpen(open);
          if (!open) setConfirmText("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this request?</DialogTitle>
            <DialogDescription>
              This cannot be undone. The request, its field values, and any
              comments will be removed. Type <strong>DELETE</strong> to
              confirm.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 pt-2">
            <Label htmlFor="confirm-delete" className="sr-only">
              Type DELETE
            </Label>
            <Input
              id="confirm-delete"
              autoFocus
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              autoComplete="off"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={onDelete}
              disabled={pending || !confirmReady}
            >
              {pending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={reasonOpen}
        onOpenChange={(open) => {
          setReasonOpen(open);
          if (!open) {
            setReasonText("");
            setPendingStatusId(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Move to &ldquo;{pendingStatus?.label ?? "this status"}&rdquo;
            </DialogTitle>
            <DialogDescription>
              Add a short reason for the requester (optional but recommended —
              especially when declining). It&apos;s included in the notification
              they receive.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 pt-2">
            <Label htmlFor="decline-reason" className="sr-only">
              Reason
            </Label>
            <Textarea
              id="decline-reason"
              autoFocus
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              placeholder="e.g. Out of scope for this quarter — revisit after the settlement work ships."
              rows={3}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setReasonOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              onClick={() =>
                pendingStatusId &&
                commitStatus(pendingStatusId, reasonText.trim() || null)
              }
              disabled={pending}
            >
              {pending ? "Updating…" : "Update & notify"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
