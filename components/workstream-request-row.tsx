"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { LocalTime } from "@/components/local-time";

export interface WorkstreamRequestRowProps {
  id: string;
  /** 1-based rank within the workstream, or null when unsequenced. */
  position: number | null;
  title: string;
  teamName: string | null;
  status: { label: string; color: string } | null;
  deadline: string | null;
  summary: string | null;
  authorLabel: string;
  updatedAt: string;
  workstreamName: string;
}

export function WorkstreamRequestRow({
  id,
  position,
  title,
  teamName,
  status,
  deadline,
  summary,
  authorLabel,
  updatedAt,
  workstreamName,
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
    const width = 320;
    const margin = 8;
    let left = rect.right + margin;
    if (left + width > window.innerWidth - margin) {
      left = Math.max(margin, rect.left - width - margin);
    }
    const top = Math.min(rect.top, window.innerHeight - 220);
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
          className="block truncate text-sm font-medium hover:underline"
          title={title}
        >
          {title}
        </Link>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
          {teamName && <span className="truncate">{teamName}</span>}
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
          className="pointer-events-none fixed z-50 w-80 rounded-xl border bg-popover p-4 text-popover-foreground shadow-lg"
          style={{ top: preview.top, left: preview.left }}
          role="tooltip"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold leading-tight">{title}</p>
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

          <dl className="mt-3 space-y-1.5 text-xs">
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 text-muted-foreground">Workstream</dt>
              <dd className="min-w-0 font-medium">{workstreamName}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 text-muted-foreground">Requested by</dt>
              <dd className="min-w-0 font-medium">{teamName ?? "—"}</dd>
            </div>
            {deadline && (
              <div className="flex gap-2">
                <dt className="w-20 shrink-0 text-muted-foreground">Deadline</dt>
                <dd
                  className={cn(
                    "min-w-0 font-medium",
                    overdue && "text-destructive"
                  )}
                >
                  <LocalTime value={deadline} mode="dateFull" />
                  {overdue && " · overdue"}
                </dd>
              </div>
            )}
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 text-muted-foreground">Author</dt>
              <dd className="min-w-0 truncate">{authorLabel}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 text-muted-foreground">Updated</dt>
              <dd className="min-w-0">
                <LocalTime value={updatedAt} />
              </dd>
            </div>
          </dl>

          {summary && (
            <p className="mt-3 line-clamp-4 border-t pt-3 text-xs text-muted-foreground">
              {summary}
            </p>
          )}
        </div>
      )}
    </li>
  );
}
