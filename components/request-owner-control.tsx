"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserCircle2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setRequestOwner } from "@/app/(app)/requests/actions";

interface OwnerCandidate {
  id: string;
  label: string;
}

const NONE = "__none__";

/**
 * Assign the request's owner (DRI) from the owning team's members. Read-only
 * label when the caller can't assign.
 */
export function RequestOwnerControl({
  requestId,
  currentOwnerId,
  currentOwnerLabel,
  candidates,
  canAssign,
}: {
  requestId: string;
  currentOwnerId: string | null;
  currentOwnerLabel: string | null;
  candidates: OwnerCandidate[];
  canAssign: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = React.useState<string>(currentOwnerId ?? NONE);
  const [pending, startTransition] = React.useTransition();

  if (!canAssign) {
    return (
      <p className="flex items-center gap-2 text-sm">
        <UserCircle2 className="h-4 w-4 text-muted-foreground" />
        {currentOwnerLabel ? (
          <span className="font-medium">{currentOwnerLabel}</span>
        ) : (
          <span className="text-muted-foreground">No owner assigned yet.</span>
        )}
      </p>
    );
  }

  function onChange(next: string) {
    const prev = value;
    setValue(next);
    startTransition(async () => {
      try {
        await setRequestOwner(requestId, next === NONE ? null : next);
        toast.success(next === NONE ? "Owner cleared" : "Owner assigned");
        router.refresh();
      } catch (err) {
        setValue(prev);
        toast.error(err instanceof Error ? err.message : "Could not set owner");
      }
    });
  }

  return (
    <div className="space-y-2">
      <Select value={value} onValueChange={onChange} disabled={pending}>
        <SelectTrigger className="w-full sm:w-72">
          <SelectValue placeholder="No owner" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>No owner</SelectItem>
          {candidates.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {candidates.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No owning-team members to assign yet.
        </p>
      )}
    </div>
  );
}
