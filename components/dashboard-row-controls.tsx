"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
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
  setWorkstreamPriority,
} from "@/app/(app)/requests/actions";
import type { Status } from "@/lib/types";

interface DashboardRowControlsProps {
  requestId: string;
  currentStatusId: string | null;
  /** Raw team_priority — the requesting team's rank within its group. */
  currentPriority: number;
  /** Raw workstream_priority — the owning team's rank across the workstream. */
  currentWorkstreamPriority: number;
  statuses: Status[];
  /** Show the status select. Global admins only. Defaults to true. */
  canEditStatus?: boolean;
  /**
   * Show the requester-priority stepper. Global admins and the requesting
   * team's admin. Defaults to true.
   */
  canEditRequester?: boolean;
  /**
   * Show the workstream-priority stepper. Global admins and an admin of a team
   * that owns the workstream. Defaults to false.
   */
  canEditWorkstream?: boolean;
  /** Number of requests in the requester group — caps the requester stepper. */
  requesterMax?: number;
  /** Number of requests in the workstream — caps the workstream stepper. */
  workstreamMax?: number;
}

export function DashboardRowControls({
  requestId,
  currentStatusId,
  currentPriority,
  currentWorkstreamPriority,
  statuses,
  canEditStatus = true,
  canEditRequester = true,
  canEditWorkstream = false,
  requesterMax = 1,
  workstreamMax = 1,
}: DashboardRowControlsProps) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

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

  if (!canEditRequester && !canEditWorkstream && !canEditStatus) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      {canEditRequester && (
        <PriorityStepper
          label="Team rank"
          current={currentPriority}
          max={requesterMax}
          successLabel="Team priority"
          commit={(n) => setTeamPriority(requestId, n)}
        />
      )}
      {canEditWorkstream && (
        <PriorityStepper
          label="Workstream rank"
          current={currentWorkstreamPriority}
          max={workstreamMax}
          successLabel="Workstream priority"
          commit={(n) => setWorkstreamPriority(requestId, n)}
        />
      )}
      {canEditStatus && (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Status
          </span>
          <Select
            value={currentStatusId ?? undefined}
            onValueChange={onStatusChange}
            disabled={pending}
          >
            <SelectTrigger className="h-8 w-[150px] text-xs">
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
      )}
    </div>
  );
}

/**
 * A labeled priority control: shows the current rank ("#3 of 7"), lets you nudge
 * it up/down with arrows (up = higher priority / toward #1), or type a rank
 * directly. Commits via the supplied server action; clamps to the group size so
 * you can't rank higher than the number of requests.
 */
function PriorityStepper({
  label,
  current,
  max,
  successLabel,
  commit,
}: {
  /** Human label, e.g. "Team rank" / "Workstream rank". */
  label: string;
  /** Stored 0-based rank. Displayed 1-based. */
  current: number;
  /** Number of requests in the group; rank can't exceed this. */
  max: number;
  successLabel: string;
  /** Receives the 0-based target index. */
  commit: (value: number) => Promise<unknown>;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [draft, setDraft] = React.useState<string>(String(current + 1));

  React.useEffect(() => {
    setDraft(String(current + 1));
  }, [current]);

  const cap = Math.max(max, 1);
  const atTop = current <= 0;
  const atBottom = current >= cap - 1;
  const title = `${successLabel} — #${current + 1} of ${cap}. Lower number = higher priority.`;

  // Move to a 0-based target index (clamped), then persist.
  function moveTo(targetIndex: number) {
    const clamped = Math.max(0, Math.min(targetIndex, cap - 1));
    if (clamped === current) {
      setDraft(String(current + 1));
      return;
    }
    startTransition(async () => {
      try {
        await commit(clamped);
        toast.success(`${successLabel} set to #${clamped + 1}`);
        router.refresh();
      } catch (err) {
        setDraft(String(current + 1));
        toast.error(
          err instanceof Error ? err.message : "Could not set priority"
        );
      }
    });
  }

  function commitDraft(raw: string) {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isNaN(parsed)) {
      setDraft(String(current + 1));
      return;
    }
    moveTo(parsed - 1); // display is 1-based → 0-based index
  }

  return (
    <div className="flex flex-col gap-1" title={title}>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <div className="flex items-center gap-1.5">
        <div className="inline-flex h-8 items-stretch overflow-hidden rounded-md border bg-background">
          <input
            type="number"
            min={1}
            max={cap}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => commitDraft(draft)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                (e.currentTarget as HTMLInputElement).blur();
              } else if (e.key === "Escape") {
                setDraft(String(current + 1));
                (e.currentTarget as HTMLInputElement).blur();
              }
            }}
            disabled={pending}
            aria-label={`${successLabel} (1–${cap})`}
            className="w-10 bg-transparent px-1 text-center text-xs font-medium tabular-nums outline-none [appearance:textfield] disabled:opacity-50 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <div className="flex flex-col border-l">
            <button
              type="button"
              aria-label="Move up (higher priority)"
              title="Move up (higher priority)"
              disabled={pending || atTop}
              onClick={() => moveTo(current - 1)}
              className="flex flex-1 items-center justify-center px-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30"
            >
              <ChevronUp className="h-3 w-3" />
            </button>
            <button
              type="button"
              aria-label="Move down (lower priority)"
              title="Move down (lower priority)"
              disabled={pending || atBottom}
              onClick={() => moveTo(current + 1)}
              className="flex flex-1 items-center justify-center border-t px-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30"
            >
              <ChevronDown className="h-3 w-3" />
            </button>
          </div>
        </div>
        <span className="text-[11px] text-muted-foreground">of {cap}</span>
      </div>
    </div>
  );
}
