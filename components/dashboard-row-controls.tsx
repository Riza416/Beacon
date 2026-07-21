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
          title="Requester priority"
          successLabel="Requester priority"
          commit={(n) => setTeamPriority(requestId, n)}
        />
      )}
      {canEditWorkstream && (
        <PriorityField
          prefix="W"
          current={currentWorkstreamPriority}
          title="Workstream priority"
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
  title,
  successLabel,
  commit,
}: {
  /** Short caption to distinguish the two numbers, e.g. "T" or "W". */
  prefix: string;
  current: number;
  title: string;
  successLabel: string;
  commit: (value: number) => Promise<unknown>;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [draft, setDraft] = React.useState<string>(String(current));

  React.useEffect(() => {
    setDraft(String(current));
  }, [current]);

  function commitDraft(rawValue: string) {
    const parsed = Number.parseInt(rawValue, 10);
    if (Number.isNaN(parsed) || parsed < 0) {
      setDraft(String(current));
      toast.error("Priority must be a positive number");
      return;
    }
    if (parsed === current) {
      return; // no-op
    }
    startTransition(async () => {
      try {
        await commit(parsed);
        toast.success(`${successLabel} set to ${parsed}`);
        router.refresh();
      } catch (err) {
        setDraft(String(current));
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
        min={0}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => commitDraft(draft)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.currentTarget as HTMLInputElement).blur();
          } else if (e.key === "Escape") {
            setDraft(String(current));
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
