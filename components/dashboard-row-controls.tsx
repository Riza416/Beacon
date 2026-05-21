"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  setTeamPriority,
} from "@/app/(app)/requests/actions";
import type { Status } from "@/lib/types";

interface DashboardRowControlsProps {
  requestId: string;
  currentStatusId: string | null;
  /** The request's raw team_priority value (admin-visible numeric). */
  currentPriority: number;
  statuses: Status[];
  /** Disable the up/down buttons when this row is at the top/bottom of its group. */
  isFirstInTeam: boolean;
  isLastInTeam: boolean;
}

export function DashboardRowControls({
  requestId,
  currentStatusId,
  currentPriority,
  statuses,
  isFirstInTeam,
  isLastInTeam,
}: DashboardRowControlsProps) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [priorityDraft, setPriorityDraft] = React.useState<string>(
    String(currentPriority)
  );

  // Keep the input in sync if the server pushes a new value (e.g. after
  // someone else reorders).
  React.useEffect(() => {
    setPriorityDraft(String(currentPriority));
  }, [currentPriority]);

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

  function commitPriority(rawValue: string) {
    const parsed = Number.parseInt(rawValue, 10);
    if (Number.isNaN(parsed) || parsed < 0) {
      setPriorityDraft(String(currentPriority));
      toast.error("Priority must be a positive number");
      return;
    }
    if (parsed === currentPriority) {
      return; // no-op
    }
    startTransition(async () => {
      try {
        await setTeamPriority(requestId, parsed);
        toast.success(`Priority set to ${parsed}`);
        router.refresh();
      } catch (err) {
        setPriorityDraft(String(currentPriority));
        toast.error(
          err instanceof Error ? err.message : "Could not set priority"
        );
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
      <Input
        type="number"
        min={0}
        value={priorityDraft}
        onChange={(e) => setPriorityDraft(e.target.value)}
        onBlur={() => commitPriority(priorityDraft)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.currentTarget as HTMLInputElement).blur();
          } else if (e.key === "Escape") {
            setPriorityDraft(String(currentPriority));
            (e.currentTarget as HTMLInputElement).blur();
          }
        }}
        disabled={pending}
        aria-label="Set priority"
        title="Type a number to set this request's priority directly"
        className="h-7 w-16 text-center text-xs tabular-nums"
      />
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
