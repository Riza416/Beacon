"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Checkbox } from "@/components/ui/checkbox";

/** Toggles a `?done=hide` param (preserving other params) to hide completed requests. */
export function HideDoneToggle({ hidden }: { hidden: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  function toggle(on: boolean) {
    const params = new URLSearchParams(search.toString());
    if (on) params.set("done", "hide");
    else params.delete("done");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
      <Checkbox
        checked={hidden}
        onCheckedChange={(c) => toggle(c === true)}
        aria-label="Hide completed requests"
      />
      Hide completed
    </label>
  );
}
