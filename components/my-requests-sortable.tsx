"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { GripVertical, Layers } from "lucide-react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LocalTime } from "@/components/local-time";
import { cn } from "@/lib/utils";
import { reorderMineFull } from "@/app/(app)/requests/mine/actions";

export interface MyRequestRow {
  id: string;
  title: string;
  summary: string | null;
  state: "draft" | "submitted";
  priority: number;
  submitted_at: string | null;
  updated_at: string;
  notion_url: string | null;
  status: { id: string; label: string; color: string; is_terminal: boolean } | null;
  product: { id: string; name: string } | null;
}

interface MyRequestsSortableProps {
  initialRows: MyRequestRow[];
}

const NO_WORKSTREAM = "__none__";

interface RowGroup {
  key: string;
  name: string;
  rows: MyRequestRow[];
}

/**
 * Bucket rows by workstream (product), preserving each row's incoming order
 * within its bucket (the page hands them over priority-sorted). Group display
 * order is workstream name ascending, with "No workstream" always last.
 */
function groupRows(rows: MyRequestRow[]): RowGroup[] {
  const groups = new Map<string, RowGroup>();
  for (const r of rows) {
    const key = r.product?.id ?? NO_WORKSTREAM;
    const g = groups.get(key) ?? {
      key,
      name: r.product?.name ?? "No workstream",
      rows: [],
    };
    g.rows.push(r);
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => {
    if (a.key === NO_WORKSTREAM) return 1;
    if (b.key === NO_WORKSTREAM) return -1;
    return a.name.localeCompare(b.name);
  });
}

export function MyRequestsSortable({ initialRows }: MyRequestsSortableProps) {
  const router = useRouter();
  const [rows, setRows] = React.useState<MyRequestRow[]>(initialRows);
  const [isPending, startTransition] = React.useTransition();

  // Keep local state in sync when the server pushes a fresh list (e.g. after
  // creating a new request elsewhere). Cheap to compare by joined ids.
  React.useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Reorder happens WITHIN a single workstream group. We arrayMove inside that
  // group, then rebuild the FULL ordered id list as the concatenation of every
  // group's rows in group display order (with the reordered group swapped in).
  // Persisting that full list keeps each request's global `priority` (= its
  // index) consistent with the grouped display the user sees.
  function handleDragEnd(groupKey: string, event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const groups = groupRows(rows);
    const target = groups.find((g) => g.key === groupKey);
    if (!target) return;

    const oldIndex = target.rows.findIndex((r) => r.id === active.id);
    const newIndex = target.rows.findIndex((r) => r.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(target.rows, oldIndex, newIndex);
    const newFullList = groups.flatMap((g) =>
      g.key === groupKey ? reordered : g.rows
    );

    const prev = rows;
    setRows(newFullList);

    const fullIds = newFullList.map((r) => r.id);
    startTransition(async () => {
      try {
        await reorderMineFull(fullIds);
        router.refresh();
      } catch (err) {
        // Roll back optimistic update on failure.
        setRows(prev);
        const message =
          err instanceof Error ? err.message : "Could not reorder";
        toast.error(message);
      }
    });
  }

  const groups = groupRows(rows);

  return (
    <div
      className={cn("space-y-6", isPending && "pointer-events-none opacity-90")}
      aria-busy={isPending}
    >
      {groups.map((group) => (
        <section key={group.key} className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <Layers className="h-3.5 w-3.5 text-muted-foreground" />
            <h3 className="text-sm font-semibold">{group.name}</h3>
            <span className="text-xs text-muted-foreground">
              {group.rows.length}
            </span>
          </div>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={(event) => handleDragEnd(group.key, event)}
          >
            <SortableContext
              items={group.rows.map((r) => r.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="grid gap-3">
                {group.rows.map((r) => (
                  <SortableRow key={r.id} row={r} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </section>
      ))}
    </div>
  );
}

interface SortableRowProps {
  row: MyRequestRow;
}

function SortableRow({ row }: SortableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: row.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const href =
    row.state === "draft" ? `/requests/${row.id}/edit` : `/requests/${row.id}`;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex items-center gap-3 rounded-lg border bg-card p-3 transition-shadow",
        isDragging && "z-10 opacity-90 shadow-lg"
      )}
    >
      <button
        type="button"
        aria-label={`Drag to reorder ${row.title || "draft"}`}
        className={cn(
          "flex h-7 w-5 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground/40 transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing group-hover:text-muted-foreground",
          isDragging && "cursor-grabbing text-foreground"
        )}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link href={href} className="truncate text-sm font-medium hover:underline">
            {row.title || "Untitled draft"}
          </Link>
          {row.state === "draft" && (
            <Badge variant="secondary" className="shrink-0">
              Draft
            </Badge>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
          {row.product && (
            <>
              <span className="inline-flex items-center gap-1">
                <Layers className="h-3 w-3" />
                {row.product.name}
              </span>
              <span>·</span>
            </>
          )}
          <span>
            Updated <LocalTime value={row.updated_at} />
          </span>
        </div>
      </div>

      {row.status && (
        <span
          className="hidden shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs sm:inline-flex"
          style={{
            backgroundColor: `${row.status.color}22`,
            color: row.status.color,
          }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: row.status.color }}
          />
          {row.status.label}
        </span>
      )}

      <Button asChild variant="ghost" size="sm" className="shrink-0">
        <Link href={href}>{row.state === "draft" ? "Edit" : "View"}</Link>
      </Button>
    </div>
  );
}
