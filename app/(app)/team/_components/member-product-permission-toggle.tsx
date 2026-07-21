"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { setMemberProductPermissions } from "@/app/(app)/team/actions";

interface Props {
  profileId: string;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

type Perm = "create" | "edit" | "delete";

/**
 * Team-admin control: grant a member create / edit / delete on the team's
 * products as three independent checkboxes. Optimistic; rolls back on error.
 */
export function MemberProductPermissionToggle({
  profileId,
  canCreate,
  canEdit,
  canDelete,
}: Props) {
  const router = useRouter();
  const [perms, setPerms] = React.useState({
    create: canCreate,
    edit: canEdit,
    delete: canDelete,
  });
  const [pending, startTransition] = React.useTransition();

  function toggle(which: Perm, next: boolean) {
    const prev = perms;
    const updated = { ...perms, [which]: next };
    setPerms(updated);
    startTransition(async () => {
      try {
        await setMemberProductPermissions(profileId, updated);
        router.refresh();
      } catch (err) {
        setPerms(prev); // rollback
        toast.error(
          err instanceof Error ? err.message : "Could not update permissions"
        );
      }
    });
  }

  const items: { key: Perm; label: string }[] = [
    { key: "create", label: "Create" },
    { key: "edit", label: "Edit" },
    { key: "delete", label: "Delete" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {items.map(({ key, label }) => {
        const id = `${key}-${profileId}`;
        return (
          <div key={key} className="flex items-center gap-1.5">
            <Checkbox
              id={id}
              checked={perms[key]}
              disabled={pending}
              onCheckedChange={(c) => toggle(key, c === true)}
            />
            <Label
              htmlFor={id}
              className="text-xs font-normal text-muted-foreground"
            >
              {label}
            </Label>
          </div>
        );
      })}
    </div>
  );
}
