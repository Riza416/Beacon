"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  updateNotionUrl,
  updateRequestStatus,
} from "@/app/(app)/requests/actions";
import type { Status } from "@/lib/types";

interface AdminControlsProps {
  requestId: string;
  statuses: Status[];
  currentStatusId: string | null;
  currentNotionUrl: string | null;
}

export function AdminControls({
  requestId,
  statuses,
  currentStatusId,
  currentNotionUrl,
}: AdminControlsProps) {
  const router = useRouter();
  const [statusId, setStatusId] = React.useState<string>(currentStatusId ?? "");
  const [notion, setNotion] = React.useState<string>(currentNotionUrl ?? "");
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [confirmText, setConfirmText] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const confirmReady = confirmText.trim().toUpperCase() === "DELETE";

  function onChangeStatus(next: string) {
    if (next === statusId) return;
    const prev = statusId;
    setStatusId(next);
    startTransition(async () => {
      try {
        await updateRequestStatus(requestId, next);
        toast.success("Status updated");
        router.refresh();
      } catch (err) {
        setStatusId(prev);
        const message =
          err instanceof Error ? err.message : "Could not update status";
        toast.error(message);
      }
    });
  }

  function onSaveNotion() {
    startTransition(async () => {
      try {
        await updateNotionUrl(requestId, notion);
        toast.success("Notion URL saved");
        router.refresh();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Could not save URL";
        toast.error(message);
      }
    });
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
          Triage status, paste the Notion ticket, or remove this request.
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

        <div className="space-y-2">
          <Label htmlFor="notion">Notion URL</Label>
          <div className="flex gap-2">
            <Input
              id="notion"
              value={notion}
              onChange={(e) => setNotion(e.target.value)}
              placeholder="https://www.notion.so/..."
            />
            <Button onClick={onSaveNotion} disabled={pending}>
              Save
            </Button>
          </div>
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
    </Card>
  );
}
