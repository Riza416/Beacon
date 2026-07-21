"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { setTeamProductPermission } from "../actions";

interface TeamProductPermissionToggleProps {
  teamId: string;
  canManageProducts: boolean;
}

export function TeamProductPermissionToggle({
  teamId,
  canManageProducts,
}: TeamProductPermissionToggleProps) {
  const [isPending, startTransition] = useTransition();

  function onCheckedChange(checked: boolean) {
    const formData = new FormData();
    formData.set("teamId", teamId);
    formData.set("canManage", checked ? "true" : "false");
    startTransition(async () => {
      try {
        await setTeamProductPermission(formData);
        toast.success(
          checked ? "Product management enabled" : "Product management disabled"
        );
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to update permission";
        toast.error(message);
      }
    });
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <Checkbox
        checked={canManageProducts}
        onCheckedChange={(checked) => onCheckedChange(checked === true)}
        disabled={isPending}
        aria-label="Can manage products"
      />
      <span>Can manage products</span>
    </label>
  );
}
