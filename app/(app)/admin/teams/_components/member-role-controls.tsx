"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Role } from "@/lib/types";
import { setMemberTeamAdmin } from "../actions";

interface MemberRoleControlsProps {
  teamId: string;
  profileId: string;
  role: Role;
}

export function MemberRoleControls({
  teamId,
  profileId,
  role,
}: MemberRoleControlsProps) {
  const [isPending, startTransition] = useTransition();

  function setAdmin(makeAdmin: boolean) {
    const formData = new FormData();
    formData.set("teamId", teamId);
    formData.set("profileId", profileId);
    formData.set("makeAdmin", makeAdmin ? "true" : "false");
    startTransition(async () => {
      try {
        await setMemberTeamAdmin(formData);
        toast.success(makeAdmin ? "Promoted to team admin" : "Removed team admin");
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to update role";
        toast.error(message);
      }
    });
  }

  if (role === "admin") {
    return (
      <span className="text-xs text-muted-foreground">Global admin</span>
    );
  }

  if (role === "team_admin") {
    return (
      <div className="flex items-center justify-end gap-2">
        <Badge variant="secondary">Team admin</Badge>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setAdmin(false)}
          disabled={isPending}
        >
          {isPending ? "Saving..." : "Remove admin"}
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setAdmin(true)}
      disabled={isPending}
    >
      {isPending ? "Saving..." : "Make team admin"}
    </Button>
  );
}
