"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  updateRequestStatus,
  reorderTeamPriority,
} from "@/app/(app)/requests/actions";
import type { Status } from "@/lib/types";

interface DashboardRowControlsProps {
  requestId: string;
  currentStatusId: string | null;
  statuses: Status[];
  /** Disable the up/down buttons when this row is at the top/bottom. */
  isFirstInTeam: boolean;
  isLastInTeam: boolean;
}

export function DashboardRowControls({
  requestId,
  currentStatusId,
  statuses,
  isFirstInTeam,
  isLastInTeam,
}: DashboardRowControlsProps) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function move(direction: "up" | "down") {
    startTransition(async () => {
      try {
        await reorderTeamPriority(requestId, direction);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not reorder");
      }
    });
  }

  function onStatusChange(next: string) {
    startTransition(async () => {
      try {
        await updateRequestStatus(requestId, next);
        toast.success("Status updated");
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not update status"
        );
      }
    });
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => move("up")}
        disabled={pending || isFirstInTeam}
        aria-label="Move up"
      >
        <ChevronUp className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => move("down")}
        disabled={pending || isLastInTeam}
        aria-label="Move down"
      >
        <ChevronDown className="h-4 w-4" />
      </Button>
      <Select
        value={currentStatusId ?? undefined}
        onValueChange={onStatusChange}
        disabled={pending}
      >
        <SelectTrigger className="h-8 w-[140px] text-xs">
          <SelectValue placeholder="Set status" />
        </SelectTrigger>
        <SelectContent>
          {statuses.map((s) => (
            <SelectItem key={s.id} value={s.id} className="text-xs">
              <span className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: s.color }}
                />
                {s.label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
