"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { reorderMine } from "@/app/(app)/requests/actions";

interface ReorderButtonsProps {
  requestId: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

export function ReorderButtons({
  requestId,
  canMoveUp,
  canMoveDown,
}: ReorderButtonsProps) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function move(direction: "up" | "down") {
    startTransition(async () => {
      try {
        await reorderMine(requestId, direction);
        router.refresh();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Could not reorder";
        toast.error(message);
      }
    });
  }

  return (
    <div className="flex flex-col">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={!canMoveUp || pending}
        onClick={() => move("up")}
        aria-label="Move up"
        className="h-6 w-6"
      >
        <ChevronUp className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={!canMoveDown || pending}
        onClick={() => move("down")}
        aria-label="Move down"
        className="h-6 w-6"
      >
        <ChevronDown className="h-4 w-4" />
      </Button>
    </div>
  );
}
