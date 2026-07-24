"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setProductOwner } from "@/app/(app)/admin/products/actions";

interface OwnerPickerProps {
  productId: string;
  /** The product's current owner, if any. */
  currentOwnerId: string | null;
  /** Profiles eligible to own it — members of the product's owning team(s). */
  members: { id: string; full_name: string | null; email: string | null }[];
  /** Whether the product has any owning team yet. */
  hasOwningTeams: boolean;
}

const NONE = "__none__";

/**
 * Inline control to designate ONE person as a workstream's owner. The list is
 * restricted to members of the product's owning team(s); if no team owns it
 * yet, the picker is replaced with a hint. Optimistic; rolls back on error.
 */
export function OwnerPicker({
  productId,
  currentOwnerId,
  members,
  hasOwningTeams,
}: OwnerPickerProps) {
  const router = useRouter();
  const [ownerId, setOwnerId] = React.useState<string | null>(currentOwnerId);
  const [pending, startTransition] = React.useTransition();

  if (!hasOwningTeams) {
    return (
      <span className="text-xs text-muted-foreground">
        Assign an owning team first
      </span>
    );
  }

  function onChange(value: string) {
    const next = value === NONE ? null : value;
    const prev = ownerId;
    setOwnerId(next);
    startTransition(async () => {
      try {
        await setProductOwner(productId, next);
        router.refresh();
      } catch (err) {
        setOwnerId(prev); // rollback
        toast.error(
          err instanceof Error ? err.message : "Could not set the owner"
        );
      }
    });
  }

  return (
    <Select value={ownerId ?? NONE} onValueChange={onChange} disabled={pending}>
      <SelectTrigger className="h-8 w-48 text-sm">
        <SelectValue placeholder="No owner" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>No owner</SelectItem>
        {members.map((m) => (
          <SelectItem key={m.id} value={m.id}>
            {m.full_name || m.email || "Unnamed"}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
