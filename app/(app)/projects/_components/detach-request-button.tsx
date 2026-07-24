"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { X } from "lucide-react";
import { setRequestProject } from "../actions";

/** Remove a request from its project (does not delete the request). */
export function DetachRequestButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function detach() {
    startTransition(async () => {
      try {
        await setRequestProject(requestId, null);
        toast.success("Removed from project");
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not remove request"
        );
      }
    });
  }

  return (
    <button
      type="button"
      onClick={detach}
      disabled={isPending}
      title="Remove from project"
      aria-label="Remove from project"
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
    >
      <X className="h-4 w-4" />
    </button>
  );
}
