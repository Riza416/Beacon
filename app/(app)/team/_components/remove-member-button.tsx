"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { removeMember } from "@/app/(app)/team/actions";

interface RemoveMemberButtonProps {
  teamId: string;
  profileId: string;
}

export function RemoveMemberButton({
  teamId,
  profileId,
}: RemoveMemberButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      try {
        await removeMember(teamId, profileId);
        toast.success("Member removed");
        router.refresh();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to remove member";
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
