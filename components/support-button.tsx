"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ThumbsUp } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  supportRequest,
  unsupportRequest,
} from "@/app/(app)/requests/actions";

/**
 * "+1 / we need this too" toggle with a live count. Optimistic; rolls back on
 * failure. The demand signal feeds owner prioritization and Analytics.
 */
export function SupportButton({
  requestId,
  initialCount,
  initialSupported,
  size = "default",
}: {
  requestId: string;
  initialCount: number;
  initialSupported: boolean;
  size?: "default" | "sm";
}) {
  const router = useRouter();
  const [supported, setSupported] = React.useState(initialSupported);
  const [count, setCount] = React.useState(initialCount);
  const [pending, startTransition] = React.useTransition();

  function toggle() {
    const next = !supported;
    setSupported(next);
    setCount((c) => Math.max(0, c + (next ? 1 : -1)));
    startTransition(async () => {
      try {
        if (next) {
          await supportRequest(requestId);
          toast.success("+1 added — thanks, this helps prioritization");
        } else {
          await unsupportRequest(requestId);
          toast.success("+1 removed");
        }
        router.refresh();
      } catch (err) {
        setSupported(!next);
        setCount((c) => Math.max(0, c + (next ? -1 : 1)));
        toast.error(
          err instanceof Error ? err.message : "Could not update your +1"
        );
      }
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      title={supported ? "Remove your +1" : "+1 — we need this too"}
      aria-pressed={supported}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium transition-colors disabled:opacity-60",
        size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm",
        supported
          ? "border-primary/40 bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      <ThumbsUp
        className={cn(size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4")}
      />
      <span className="tabular-nums">{count}</span>
    </button>
  );
}
