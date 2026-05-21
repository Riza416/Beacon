"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { removeMemberFromTeam } from "../actions";

interface RemoveMemberButtonProps {
  teamId: string;
  profileId: string;
}

export function RemoveMemberButton({ teamId, profileId }: RemoveMemberButtonProps) {
  const [isPending, startTransition] = useTransition();

  function onClick() {
    const formData = new FormData();
    formData.set("teamId", teamId);
    formData.set("profileId", profileId);
    startTransition(async () => {
      try {
        await removeMemberFromTeam(formData);
        toast.success("Member removed");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to remove member";
        toast.error(message);
      }
    });
  }

  return (
    <Button variant="ghost" size="sm" onClick={onClick} disabled={isPending}>
      {isPending ? "Removing..." : "Remove"}
    </Button>
  );
}
