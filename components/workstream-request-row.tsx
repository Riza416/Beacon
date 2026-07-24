"use client";

import * as React from "react";
import Link from "next/link";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { LocalTime } from "@/components/local-time";

/** A filled field value for the hover snapshot: free text OR a set of chips. */
export interface SnapshotField {
  label: string;
  text?: string;
  chips?: string[];
}

export interface WorkstreamRequestRowProps {
  id: string;
  /** 1-based rank within the workstream, or null when unsequenced. */
  position: number | null;
  title: string;
  teamName: string | null;
  status: { label: string; color: string } | null;
  deadline: string | null;
  summary: string | null;
  /** Filled custom fields (Requirements, Value, …) for the snapshot. */
  fields: SnapshotField[];
  workstreamName: string;
  /** Optional small badge shown on the row, e.g. "Tagged". */
  tag?: string;
  /** Show a lock next to the title when the request is private. */
  isPrivate?: boolean;
  /** Days a submitted request has waited with no response yet (null = hide). */
  agingDays?: number | null;
}

export function WorkstreamRequestRow({
  id,
  position,
  title,
  teamName,
  status,
  deadline,
  summary,
  fields,
  workstreamName,
  tag,
  isPrivate,
  agingDays,
}: WorkstreamRequestRowProps) {
  const overdue = deadline ? new Date(deadline) < new Date() : false;
  const [preview, setPreview] = React.useState<{ top: number; left: number } | null>(
    null
  );

  // Position the snapshot with fixed coordinates from the row's rect, so it
  // escapes the column's overflow-y scroll clipping. Prefer the right side;
  // flip left if there isn't room.
  function openPreview(e: React.MouseEvent<HTMLLIElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const width = 340;
    const margin = 8;
    let left = rect.right + margin;
    if (left + width > window.innerWidth - margin) {
      left = Math.max(margin, rect.left - width - margin);
    }
    const top = Math.min(rect.top, window.innerHeight - 320);
    setPreview({ top: Math.max(margin, top), left });
  }

  return (
    <li
      className="relative flex items-center gap-3 p-3"
      onMouseEnter={openPreview}
      onMouseLeave={() => setPreview(null)}
    >
      <span
        className={cn(
          "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-semibold tabular-nums",
          position !== null
            ? "bg-primary/10 text-primary"
            : "bg-muted text-muted-foreground"
        )}
      >
        {position !== null ? position : "–"}
      </span>

      <div className="min-w-0 flex-1">
        <Link
          href={`/requests/${id}`}
          className="flex items-center gap-1.5 truncate text-sm font-medium hover:underline"
          title={title}
        >
          {isPrivate && (
            <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />
          )}
          <span className="truncate">{title}</span>
        </Link>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
          {teamName && <span className="truncate">{teamName}</span>}
          {typeof agingDays === "number" && agingDays >= 1 && (
            <>
              {teamName && <span>·</span>}
              <span
                className={cn(
                  "font-medium",
                  agingDays >= 3 ? "text-destructive" : "text-amber-600 dark:text-amber-400"
                )}
              >
                submitted {agingDays}d ago · no response yet
              </span>
            </>
          )}
          {deadline && (
            <>
              {teamName && <span>·</span>}
              <span className={cn("font-medium", overdue && "text-destructive")}>
                due <LocalTime value={deadline} mode="date" />
                {overdue && " (overdue)"}
              </span>
            </>
          )}
        </div>
      </div>

      {tag && (
        <span className="shrink-0 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
          {tag}
        </span>
      )}
      {status ? (
        <span
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs"
          style={{ backgroundColor: `${status.color}22`, color: status.color }}
          title={status.label}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: status.color }}
          />
          {status.label}
        </span>
      ) : (
        <span className="shrink-0 text-xs text-muted-foreground">No status</span>
      )}

      {preview && (
        <div
          className="pointer-events-none fixed z-50 w-[340px] rounded-xl border bg-popover p-4 text-popover-foreground shadow-lg"
          style={{ top: preview.top, left: preview.left }}
          role="tooltip"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold leading-snug">{title}</p>
            {status && (
              <span
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs"
                style={{
                  backgroundColor: `${status.color}22`,
                  color: status.color,
                }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: status.color }}
                />
                {status.label}
              </span>
            )}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
            <span>{workstreamName}</span>
            {teamName && (
              <>
                <span>·</span>
                <span>{teamName}</span>
              </>
            )}
            {deadline && (
              <>
                <span>·</span>
                <span className={cn(overdue && "font-medium text-destructive")}>
                  due <LocalTime value={deadline} mode="dateFull" />
                  {overdue && " · overdue"}
                </span>
              </>
            )}
          </div>

          <div className="mt-3 max-h-72 space-y-3 overflow-y-auto">
            <SnapshotBlock label="Summary">
              {summary ? (
                <p className="whitespace-pre-wrap">{summary}</p>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </SnapshotBlock>

            {fields.map((f, i) => (
              <SnapshotBlock key={`${f.label}-${i}`} label={f.label}>
                {f.chips && f.chips.length > 0 ? (
                  <span className="flex flex-wrap gap-1">
                    {f.chips.map((c) => (
                      <span
                        key={c}
                        className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium"
                      >
                        {c}
                      </span>
                    ))}
                  </span>
                ) : (
                  <p className="whitespace-pre-wrap">{f.text}</p>
                )}
              </SnapshotBlock>
            ))}
          </div>
        </div>
      )}
    </li>
  );
}

function SnapshotBlock({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="mt-0.5 line-clamp-4 text-xs text-foreground">
        {children}
      </div>
    </div>
  );
}
