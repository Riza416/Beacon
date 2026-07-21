"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { setMemberProductPermission } from "@/app/(app)/team/actions";

interface Props {
  profileId: string;
  canManageProducts: boolean;
}

/**
 * Team-admin control: grant/revoke a member's ability to create and edit the
 * team's products. Optimistic; rolls back on error.
 */
export function MemberProductPermissionToggle({
  profileId,
  canManageProducts,
}: Props) {
  const router = useRouter();
  const [checked, setChecked] = React.useState(canManageProducts);
  const [pending, startTransition] = React.useTransition();
  const id = `pm-${profileId}`;

  function onChange(next: boolean) {
    setChecked(next);
    startTransition(async () => {
      try {
        await setMemberProductPermission(profileId, next);
        router.refresh();
      } catch (err) {
        setChecked(!next); // rollback
        toast.error(
          err instanceof Error ? err.message : "Could not update permission"
        );
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Checkbox
        id={id}
        checked={checked}
        disabled={pending}
        onCheckedChange={(c) => onChange(c === true)}
      />
      <Label htmlFor={id} className="text-xs font-normal text-muted-foreground">
        Can manage
      </Label>
    </div>
  );
}
