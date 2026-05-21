"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
  setTeamPriority,
} from "@/app/(app)/requests/actions";
import type { Status } from "@/lib/types";

interface DashboardRowControlsProps {
  requestId: string;
  currentStatusId: string | null;
  /** The request's raw team_priority value (admin-visible numeric). */
  currentPriority: number;
  statuses: Status[];
}

export function DashboardRowControls({
  requestId,
  currentStatusId,
  currentPriority,
  statuses,
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
    <div className="flex items-center gap-2">
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
