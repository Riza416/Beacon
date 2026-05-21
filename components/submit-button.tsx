"use client";

import * as React from "react";
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
} from "@/components/ui/dialog";
import { submitRequest } from "@/app/(app)/requests/actions";
import type { SubmitResult } from "@/lib/request-actions-types";

interface SubmitButtonProps {
  requestId: string;
  /** When false, the submit button is disabled with a "join a team first" hint. */
  canSubmit: boolean;
}

export function SubmitButton({ requestId, canSubmit }: SubmitButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [softModal, setSoftModal] = React.useState<{
    open: boolean;
    missing: { id: string; label: string }[];
  }>({ open: false, missing: [] });

  function doSubmit(force: boolean) {
    startTransition(async () => {
      try {
        const result: SubmitResult = await submitRequest(requestId, null, {
          force,
        });
        if (result.ok) {
          toast.success("Request submitted — you can still edit anytime");
          setSoftModal({ open: false, missing: [] });
          router.refresh();
          return;
        }
        if (result.kind === "hard") {
          toast.error(
            `Missing required: ${result.missing
              .map((m) => m.label)
              .join(", ")}`
          );
          return;
        }
        setSoftModal({ open: true, missing: result.missing });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Could not submit";
        toast.error(message);
      }
    });
  }

  return (
    <>
      <div className="flex flex-col items-end gap-1">
        <Button
          onClick={() => doSubmit(false)}
          disabled={pending || !canSubmit}
          title={
            canSubmit
              ? undefined
              : "You need to be on a team before submitting"
          }
        >
          {pending ? "Submitting…" : "Submit to product team"}
        </Button>
        {!canSubmit && (
          <p className="text-xs text-muted-foreground">
            Join a team to submit. Ask an admin.
          </p>
        )}
      </div>
      <Dialog
        open={softModal.open}
        onOpenChange={(open) => setSoftModal((p) => ({ ...p, open }))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit without these?</DialogTitle>
            <DialogDescription>
              The following fields are recommended but not filled in.
            </DialogDescription>
          </DialogHeader>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {softModal.missing.map((m) => (
              <li key={m.id}>{m.label}</li>
            ))}
          </ul>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setSoftModal({ open: false, missing: [] })}
              disabled={pending}
            >
              Go back
            </Button>
            <Button onClick={() => doSubmit(true)} disabled={pending}>
              {pending ? "Submitting…" : "Submit anyway"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
