"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { setDemoMode } from "@/app/(app)/demo-actions";

/** Admin-only pill that flips the dashboard between live data and the demo preview. */
export function DemoModeToggle({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function toggle() {
    startTransition(async () => {
      try {
        await setDemoMode(!enabled);
        toast.success(!enabled ? "Demo mode on" : "Demo mode off");
        router.refresh();
      } catch {
        toast.error("Couldn't toggle demo mode");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={enabled}
      title="Preview Beacon with fictional sample data (admins only)"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50",
        enabled
          ? "border-amber-500/50 bg-amber-500/15 text-amber-700 dark:text-amber-300"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          enabled ? "bg-amber-500" : "bg-muted-foreground/40"
        )}
      />
      Demo {enabled ? "on" : "off"}
    </button>
  );
}
