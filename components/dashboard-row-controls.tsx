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
   * Show the requester-priority input. Global admins and the requesting
   * team's admin. Defaults to true.
   */
  canEditRequester?: boolean;
  /**
   * Show the workstream-priority input. Global admins and an admin of a team
   * that owns the workstream. Defaults to false.
   */
  canEditWorkstream?: boolean;
  /** Number of requests in the requester group — caps the requester input. */
  requesterMax?: number;
  /** Number of requests in the workstream — caps the workstream input. */
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
    <div className="flex items-center gap-2">
      {canEditRequester && (
        <PriorityField
          prefix="T"
          current={currentPriority}
          max={requesterMax}
          title={`Requester priority (1–${requesterMax})`}
          successLabel="Requester priority"
          commit={(n) => setTeamPriority(requestId, n)}
        />
      )}
      {canEditWorkstream && (
        <PriorityField
          prefix="W"
          current={currentWorkstreamPriority}
          max={workstreamMax}
          title={`Workstream priority (1–${workstreamMax})`}
          successLabel="Workstream priority"
          commit={(n) => setWorkstreamPriority(requestId, n)}
        />
      )}
      {canEditStatus && (
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
      )}
    </div>
  );
}

/**
 * A single compact numeric priority input. Keeps a local draft synced from the
 * `current` prop (so a server-side reorder pushes the fresh value back in), and
 * commits on Enter / blur via the supplied server action.
 */
function PriorityField({
  prefix,
  current,
  max,
  title,
  successLabel,
  commit,
}: {
  /** Short caption to distinguish the two numbers, e.g. "T" or "W". */
  prefix: string;
  /** Stored 0-based rank. Displayed 1-based (matches the # chip). */
  current: number;
  /** Number of requests in the group; the input can't exceed this. */
  max: number;
  title: string;
  successLabel: string;
  /** Receives the 0-based target index. */
  commit: (value: number) => Promise<unknown>;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  // Display 1-based so it lines up with the position chip and "max = count".
  const [draft, setDraft] = React.useState<string>(String(current + 1));

  React.useEffect(() => {
    setDraft(String(current + 1));
  }, [current]);

  function commitDraft(rawValue: string) {
    const parsed = Number.parseInt(rawValue, 10);
    if (Number.isNaN(parsed)) {
      setDraft(String(current + 1));
      return;
    }
    // Clamp to the valid 1..max window, then convert to a 0-based index.
    const clamped = Math.min(Math.max(parsed, 1), Math.max(max, 1));
    const targetIndex = clamped - 1;
    if (clamped !== parsed) {
      setDraft(String(clamped));
    }
    if (targetIndex === current) {
      setDraft(String(current + 1));
      return; // no-op
    }
    startTransition(async () => {
      try {
        await commit(targetIndex);
        toast.success(`${successLabel} set to ${clamped}`);
        router.refresh();
      } catch (err) {
        setDraft(String(current + 1));
        toast.error(
          err instanceof Error ? err.message : "Could not set priority"
        );
      }
    });
  }

  return (
    <div className="flex items-center gap-1" title={title}>
      <span
        aria-hidden
        className="text-[10px] font-semibold uppercase leading-none text-muted-foreground"
      >
        {prefix}:
      </span>
      <Input
        type="number"
        min={1}
        max={max}
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
        aria-label={title}
        title={title}
        className="h-7 w-14 text-center text-xs tabular-nums"
      />
    </div>
  );
}
