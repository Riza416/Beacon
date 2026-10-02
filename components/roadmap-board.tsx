"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarClock,
  ExternalLink,
  GitBranch,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DAY_MS,
  addDays,
  dependencyLinks,
  groupIntoLanes,
  monthsIn,
  overrunsDeadline,
  parseDay,
  resolveBar,
  toDay,
  windowFor,
  type DependencyLink,
  type LaneKey,
  type RoadmapBar,
} from "@/lib/roadmap";
import { orderByDependencies } from "@/lib/order-by-dependencies";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface RoadmapRef {
  id: string;
  name: string;
}

export interface RoadmapStatus {
  id: string;
  label: string;
  color: string;
  terminal: boolean;
}

export interface RoadmapItem {
  id: string;
  title: string;
  /** Where clicking through goes (real or demo request page). */
  href: string;
  status: RoadmapStatus | null;
  product: RoadmapRef | null;
  /** The requester's team (requests.team_id). */
  team: RoadmapRef | null;
  project: RoadmapRef | null;
  owner: string | null;
  author: string | null;
  startDate: string | null;
  targetDate: string | null;
  /** The requester's "needed by" date. */
  deadline: string | null;
  supporters: number;
  canSchedule: boolean;
}

export interface RoadmapBoardProps {
  items: RoadmapItem[];
  /** Dependency edges: `request_id` waits on `depends_on_id`. */
  deps: { request_id: string; depends_on_id: string }[];
  statuses: RoadmapStatus[];
  /** Today as YYYY-MM-DD, from the server, so SSR and hydration agree. */
  today: string;
  /**
   * Persist a schedule change. Omitted in demo mode, where edits stay local.
   */
  onSchedule?: (
    id: string,
    startDate: string | null,
    targetDate: string | null
  ) => Promise<unknown>;
}

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const LABEL_W = 288;
const ROW_H = 44;
const LANE_H = 34;
const BAR_H = 24;
const ZOOM = {
  month: { pxPerDay: 6, snap: 1, label: "Months" },
  quarter: { pxPerDay: 2.2, snap: 7, label: "Quarters" },
} as const;
type Zoom = keyof typeof ZOOM;

type ColourKey = "status" | "product" | "project" | "team";

const GROUP_LABEL: Record<LaneKey, string> = {
  project: "Project",
  product: "Workstream",
  team: "Requesting team",
  status: "Status",
  none: "Nothing (flat)",
};
const COLOUR_LABEL: Record<ColourKey, string> = {
  status: "Status",
  product: "Workstream",
  project: "Project",
  team: "Requesting team",
};

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/** Stable, well-spread hue for anything with an id (workstream, project…). */
function hueFor(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 131 + key.charCodeAt(i)) % 3600;
  return h / 10;
}
const hashColour = (key: string) => `hsl(${hueFor(key)} 62% 48%)`;
const NEUTRAL = "#94a3b8";

function fmtDay(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`;
}

// Per-viewer preferences in localStorage. Read through useSyncExternalStore so
// the server render (and the first client render) use the default and the
// stored value takes over without a hydration mismatch. Storage can be missing
// or throw (private windows, blocked site data) — never fatal.
const PREF_EVENT = "beacon:roadmap-pref";
function subscribePref(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(PREF_EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(PREF_EVENT, cb);
  };
}
function readPref(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function usePref<T extends string>(key: string, initial: T, allowed: readonly T[]) {
  const stored = React.useSyncExternalStore(
    subscribePref,
    () => readPref(key),
    () => null
  );
  const value = stored && (allowed as readonly string[]).includes(stored) ? (stored as T) : initial;
  const set = React.useCallback(
    (v: T) => {
      try {
        window.localStorage.setItem(key, v);
      } catch {
        /* ignore — the choice just won't persist */
      }
      window.dispatchEvent(new Event(PREF_EVENT));
    },
    [key]
  );
  return [value, set] as const;
}

type Schedule = { startDate: string | null; targetDate: string | null };

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RoadmapBoard({
  items,
  deps,
  statuses,
  today,
  onSchedule,
}: RoadmapBoardProps) {
  const todayMs = parseDay(today) ?? 0;

  // --- preferences -------------------------------------------------------
  const [groupBy, setGroupBy] = usePref<LaneKey>(
    "beacon.roadmap.group",
    "project",
    ["project", "product", "team", "status", "none"]
  );
  const [colourBy, setColourBy] = usePref<ColourKey>(
    "beacon.roadmap.colour",
    "status",
    ["status", "product", "project", "team"]
  );
  const [zoom, setZoom] = usePref<Zoom>("beacon.roadmap.zoom", "month", [
    "month",
    "quarter",
  ]);
  const [linksPref, setLinksPref] = usePref<"on" | "off">(
    "beacon.roadmap.links",
    "on",
    ["on", "off"]
  );
  const [donePref, setDonePref] = usePref<"show" | "hide">(
    "beacon.roadmap.done",
    "show",
    ["show", "hide"]
  );
  const showLinks = linksPref === "on";
  const hideDone = donePref === "hide";

  // --- filters (per visit, not remembered) ---------------------------------
  const [query, setQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<Set<string>>(new Set());
  const [onlyAttention, setOnlyAttention] = React.useState(false);

  // --- schedule overrides: optimistic edits not yet confirmed by a refresh --
  // Each override remembers the server values it was made against. Once the
  // server's values move (our save landed, or someone else changed the dates)
  // the server wins again — so a stale override can never mask a real change.
  const [overrides, setOverrides] = React.useState<
    Map<string, { sched: Schedule; base: Schedule }>
  >(new Map());
  const setOverride = React.useCallback((it: RoadmapItem, sched: Schedule) => {
    setOverrides((m) => {
      const server = { startDate: it.startDate, targetDate: it.targetDate };
      const prev = m.get(it.id);
      // Keep the old baseline only while that override is still live; once
      // the server has moved on, the new edit is made against today's values.
      const live =
        prev &&
        prev.base.startDate === server.startDate &&
        prev.base.targetDate === server.targetDate;
      return new Map(m).set(it.id, { sched, base: live ? prev.base : server });
    });
  }, []);
  const clearOverride = React.useCallback((id: string) => {
    setOverrides((m) => {
      if (!m.has(id)) return m;
      const copy = new Map(m);
      copy.delete(id);
      return copy;
    });
  }, []);

  const scheduleOf = React.useCallback(
    (it: RoadmapItem): Schedule =>
    {
      const o = overrides.get(it.id);
      if (o && o.base.startDate === it.startDate && o.base.targetDate === it.targetDate) {
        return o.sched;
      }
      return { startDate: it.startDate, targetDate: it.targetDate };
    },
    [overrides]
  );

  // --- live drag state --------------------------------------------------
  const [drag, setDrag] = React.useState<{
    id: string;
    start: number;
    end: number;
  } | null>(null);
  const [hoverId, setHoverId] = React.useState<string | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const { pxPerDay, snap } = ZOOM[zoom];

  // --- derived: bars for every item (unfiltered, so the window is stable) --
  const barById = React.useMemo(() => {
    const m = new Map<string, RoadmapBar>();
    for (const it of items) {
      const s = scheduleOf(it);
      const b = resolveBar({ start_date: s.startDate, target_date: s.targetDate });
      if (b) m.set(it.id, b);
    }
    return m;
  }, [items, scheduleOf]);

  const win = React.useMemo(
    () => windowFor(Array.from(barById.values()), todayMs),
    [barById, todayMs]
  );
  const months = React.useMemo(() => monthsIn(win), [win]);
  const trackW = Math.round(((win.to - win.from) / DAY_MS) * pxPerDay);
  const xOf = React.useCallback(
    (ms: number) => ((ms - win.from) / DAY_MS) * pxPerDay,
    [win.from, pxPerDay]
  );

  // The bar as currently drawn — a live drag wins over everything else.
  const barFor = React.useCallback(
    (id: string): RoadmapBar | null => {
      if (drag && drag.id === id) {
        const base = barById.get(id);
        return { start: drag.start, end: drag.end, basis: base?.basis ?? "planned" };
      }
      return barById.get(id) ?? null;
    },
    [barById, drag]
  );

  const allLinks = React.useMemo(() => dependencyLinks(deps, barById), [deps, barById]);
  const conflictIds = React.useMemo(() => {
    const s = new Set<string>();
    for (const l of allLinks) if (l.conflict) s.add(l.to);
    return s;
  }, [allLinks]);

  const byId = React.useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const blockersOf = React.useMemo(() => {
    const m = new Map<string, string[]>();
    for (const e of deps) {
      if (!byId.has(e.request_id) || !byId.has(e.depends_on_id)) continue;
      const l = m.get(e.request_id) ?? [];
      l.push(e.depends_on_id);
      m.set(e.request_id, l);
    }
    return m;
  }, [deps, byId]);
  const blockingOf = React.useMemo(() => {
    const m = new Map<string, string[]>();
    for (const [dependent, blockers] of blockersOf) {
      for (const b of blockers) {
        const l = m.get(b) ?? [];
        l.push(dependent);
        m.set(b, l);
      }
    }
    return m;
  }, [blockersOf]);

  const overrunIds = React.useMemo(() => {
    const s = new Set<string>();
    for (const it of items) {
      if (it.status?.terminal) continue;
      if (overrunsDeadline(barById.get(it.id) ?? null, it.deadline)) s.add(it.id);
    }
    return s;
  }, [items, barById]);

  // --- filtering -----------------------------------------------------------
  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      if (hideDone && it.status?.terminal) return false;
      if (statusFilter.size > 0 && !statusFilter.has(it.status?.id ?? "__none__")) {
        return false;
      }
      if (onlyAttention && !conflictIds.has(it.id) && !overrunIds.has(it.id)) {
        return false;
      }
      if (!q) return true;
      return [
        it.title,
        it.product?.name,
        it.project?.name,
        it.team?.name,
        it.owner,
        it.author,
      ].some((s) => s?.toLowerCase().includes(q));
    });
  }, [items, query, hideDone, statusFilter, onlyAttention, conflictIds, overrunIds]);

  const scheduled = visible.filter((it) => barById.has(it.id));
  const unscheduled = visible.filter((it) => !barById.has(it.id));

  // --- colour ---------------------------------------------------------------
  const colourOf = React.useCallback(
    (it: RoadmapItem): string => {
      if (colourBy === "status") return it.status?.color ?? NEUTRAL;
      const ref =
        colourBy === "product" ? it.product : colourBy === "project" ? it.project : it.team;
      return ref ? hashColour(ref.id) : NEUTRAL;
    },
    [colourBy]
  );

  // --- lanes + vertical layout --------------------------------------------
  const lanes = React.useMemo(() => {
    // Within a lane: by planned start, then blockers above their dependents —
    // the same "dependents sit below their blockers" rule as project pages.
    const byStart = [...scheduled].sort((a, b) => {
      const d = barById.get(a.id)!.start - barById.get(b.id)!.start;
      return d !== 0 ? d : a.title.localeCompare(b.title);
    });
    const depsMap = new Map(
      Array.from(blockersOf.entries()).map(([k, v]) => [k, v.map((id) => ({ id }))])
    );
    const keyOf = (it: RoadmapItem) => {
      switch (groupBy) {
        case "project":
          return { id: it.project?.id ?? null, label: it.project?.name ?? null };
        case "product":
          return { id: it.product?.id ?? null, label: it.product?.name ?? null };
        case "team":
          return { id: it.team?.id ?? null, label: it.team?.name ?? null };
        case "status":
          return { id: it.status?.id ?? null, label: it.status?.label ?? null };
        default:
          return { id: "__all__", label: "All scheduled requests" };
      }
    };
    const empty =
      groupBy === "project"
        ? "Not in a project"
        : groupBy === "product"
          ? "No workstream"
          : groupBy === "team"
            ? "No requesting team"
            : "No status";
    return groupIntoLanes(byStart, keyOf, empty).map((lane) => ({
      ...lane,
      rows: orderByDependencies(lane.rows, depsMap),
    }));
  }, [scheduled, barById, blockersOf, groupBy]);

  const layout = React.useMemo(() => {
    const rowY = new Map<string, number>();
    let y = 0;
    const blocks: { lane: (typeof lanes)[number]; top: number }[] = [];
    for (const lane of lanes) {
      const showHeader = groupBy !== "none";
      blocks.push({ lane, top: y });
      if (showHeader) y += LANE_H;
      for (const r of lane.rows) {
        rowY.set(r.id, y);
        y += ROW_H;
      }
    }
    return { rowY, blocks, height: y };
  }, [lanes, groupBy]);

  const drawnLinks = React.useMemo(
    () => (showLinks ? allLinks.filter((l) => layout.rowY.has(l.from) && layout.rowY.has(l.to)) : []),
    [showLinks, allLinks, layout]
  );

  // --- scroll today into view once ------------------------------------------
  const scrollerRef = React.useRef<HTMLDivElement>(null);
  const didScroll = React.useRef(false);
  React.useEffect(() => {
    if (didScroll.current || !scrollerRef.current) return;
    didScroll.current = true;
    scrollerRef.current.scrollLeft = Math.max(0, xOf(todayMs) - 160);
  }, [xOf, todayMs]);

  // --- persistence -----------------------------------------------------------
  const commit = React.useCallback(
    async (id: string, next: Schedule) => {
      const it = byId.get(id);
      if (!it) return;
      const prev = scheduleOf(it);
      if (prev.startDate === next.startDate && prev.targetDate === next.targetDate) {
        return;
      }
      setOverride(it, next);
      if (!onSchedule) {
        toast.message("Demo mode — dates changed here only, nothing was saved.");
        return;
      }
      try {
        await onSchedule(id, next.startDate, next.targetDate);
      } catch (err) {
        // Put back whatever was showing before this edit.
        if (prev.startDate === it.startDate && prev.targetDate === it.targetDate) {
          clearOverride(id);
        } else {
          setOverride(it, prev);
        }
        toast.error(err instanceof Error ? err.message : "Couldn't save that date.");
      }
    },
    [byId, scheduleOf, onSchedule, setOverride, clearOverride]
  );

  // --- dragging ----------------------------------------------------------------
  const dragRef = React.useRef<{
    id: string;
    kind: "move" | "start" | "end";
    x0: number;
    start: number;
    end: number;
    moved: boolean;
    /** Live position — read on release, so it never lags a render behind. */
    liveStart: number;
    liveEnd: number;
  } | null>(null);
  // Set when a drag ends, so the click that follows doesn't open the details.
  const justDragged = React.useRef(false);
  const pendingKey = React.useRef(new Map<string, ReturnType<typeof setTimeout>>());

  function onBarPointerDown(e: React.PointerEvent, it: RoadmapItem) {
    if (e.button !== 0) return;
    const bar = barById.get(it.id);
    if (!bar) return;
    if (!it.canSchedule) return; // click still opens details via onClick
    const handle = (e.target as HTMLElement).dataset.handle as
      | "start"
      | "end"
      | undefined;
    dragRef.current = {
      id: it.id,
      kind: handle ?? "move",
      x0: e.clientX,
      start: bar.start,
      end: bar.end,
      moved: false,
      liveStart: bar.start,
      liveEnd: bar.end,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onBarPointerMove(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.x0;
    if (!d.moved && Math.abs(dx) < 4) return;
    d.moved = true;
    const days = Math.round(dx / pxPerDay / snap) * snap;
    let s = d.start;
    let en = d.end;
    if (d.kind === "move") {
      s = addDays(d.start, days);
      en = addDays(d.end, days);
    } else if (d.kind === "start") {
      s = Math.min(addDays(d.start, days), addDays(d.end, -1));
    } else {
      en = Math.max(addDays(d.end, days), addDays(d.start, 1));
    }
    d.liveStart = s;
    d.liveEnd = en;
    setDrag({ id: d.id, start: s, end: en });
  }

  function onBarPointerUp(it: RoadmapItem) {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    if (!d.moved) {
      setDrag(null);
      return; // a click — onClick opens the details
    }
    justDragged.current = true;
    setDrag(null);
    void commit(it.id, { startDate: toDay(d.liveStart), targetDate: toDay(d.liveEnd) });
  }

  function onBarClick(e: React.MouseEvent, it: RoadmapItem) {
    // A drag ends with a click event too; only a genuine click opens details.
    if (e.detail === 0) return; // keyboard-activated — handled by onKeyDown
    if (justDragged.current) {
      justDragged.current = false;
      return;
    }
    setSelectedId(it.id);
  }

  function onBarKeyDown(e: React.KeyboardEvent, it: RoadmapItem) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setSelectedId(it.id);
      return;
    }
    if (!it.canSchedule) return;
    const step = e.key === "ArrowLeft" ? -snap : e.key === "ArrowRight" ? snap : 0;
    if (!step) return;
    e.preventDefault();
    const bar = barById.get(it.id);
    if (!bar) return;
    const next: RoadmapBar = e.shiftKey
      ? { ...bar, end: Math.max(addDays(bar.end, step), addDays(bar.start, 1)) }
      : { ...bar, start: addDays(bar.start, step), end: addDays(bar.end, step) };
    const sched = { startDate: toDay(next.start), targetDate: toDay(next.end) };
    // Show it immediately; save once the keys stop, so a run of nudges is one
    // write and one activity entry rather than ten.
    setOverride(it, sched);
    const timers = pendingKey.current;
    const t = timers.get(it.id);
    if (t) clearTimeout(t);
    timers.set(
      it.id,
      setTimeout(async () => {
        timers.delete(it.id);
        if (!onSchedule) {
          toast.message("Demo mode — dates changed here only, nothing was saved.");
          return;
        }
        try {
          await onSchedule(it.id, sched.startDate, sched.targetDate);
        } catch (err) {
          clearOverride(it.id);
          toast.error(err instanceof Error ? err.message : "Couldn't save that date.");
        }
      }, 700)
    );
  }

  // --- render ---------------------------------------------------------------
  const statusesPresent = statuses.filter((s) => items.some((i) => i.status?.id === s.id));
  const canScheduleAny = items.some((i) => i.canSchedule);
  const selected = selectedId ? byId.get(selectedId) ?? null : null;
  const todayX = xOf(todayMs);

  const quarterCells: { key: string; width: number }[] = [];
  for (const m of months) {
    const key = `${String(m.year).slice(2)} Q${m.quarter}`;
    const w = m.days * pxPerDay;
    const last = quarterCells[quarterCells.length - 1];
    if (last && last.key === key) last.width += w;
    else quarterCells.push({ key, width: w });
  }

  const attentionCount = new Set([...conflictIds, ...overrunIds]).size;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
        <span>
          <b className="font-semibold text-foreground tabular-nums">{barById.size}</b>{" "}
          scheduled
        </span>
        <span>
          <b className="font-semibold text-foreground tabular-nums">
            {items.length - barById.size}
          </b>{" "}
          not scheduled yet
        </span>
        <span className={cn(conflictIds.size > 0 && "text-destructive")}>
          <b className="font-semibold tabular-nums">{conflictIds.size}</b>{" "}
          starting before a blocker finishes
        </span>
        <span className={cn(overrunIds.size > 0 && "text-amber-600 dark:text-amber-400")}>
          <b className="font-semibold tabular-nums">{overrunIds.size}</b>{" "}
          planned past the requester&rsquo;s date
        </span>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search requests, workstreams, projects, people"
            className="pl-8"
            aria-label="Search the roadmap"
          />
        </div>
        <ToolbarSelect
          label="Group by"
          value={groupBy}
          onChange={(v) => setGroupBy(v as LaneKey)}
          options={GROUP_LABEL}
        />
        <ToolbarSelect
          label="Colour by"
          value={colourBy}
          onChange={(v) => setColourBy(v as ColourKey)}
          options={COLOUR_LABEL}
        />
        <Segmented
          value={zoom}
          onChange={(v) => setZoom(v as Zoom)}
          options={{ month: ZOOM.month.label, quarter: ZOOM.quarter.label }}
          ariaLabel="Zoom"
        />
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap items-center gap-2">
        <Chip
          pressed={onlyAttention}
          onClick={() => setOnlyAttention((v) => !v)}
          tone="warn"
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          Needs attention
          <em className="not-italic opacity-70 tabular-nums">{attentionCount}</em>
        </Chip>
        {statusesPresent.map((s) => {
          const n = items.filter((i) => i.status?.id === s.id).length;
          return (
            <Chip
              key={s.id}
              pressed={statusFilter.has(s.id)}
              onClick={() =>
                setStatusFilter((prev) => {
                  const next = new Set(prev);
                  if (next.has(s.id)) next.delete(s.id);
                  else next.add(s.id);
                  return next;
                })
              }
            >
              <i
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              {s.label}
              <em className="not-italic opacity-70 tabular-nums">{n}</em>
            </Chip>
          );
        })}
        <span className="mx-1 h-5 w-px bg-border" aria-hidden />
        <Chip
          pressed={showLinks}
          onClick={() => setLinksPref(showLinks ? "off" : "on")}
        >
          <GitBranch className="h-3.5 w-3.5" />
          Dependency links
        </Chip>
        <Chip pressed={hideDone} onClick={() => setDonePref(hideDone ? "show" : "hide")}>
          Hide done
        </Chip>
      </div>

      <Legend colourBy={colourBy} items={items} statuses={statusesPresent} />

      {/* Timeline */}
      {scheduled.length === 0 ? (
        <div className="rounded-lg border bg-card p-10 text-center text-sm text-muted-foreground">
          {barById.size === 0
            ? "Nothing is scheduled yet. Open a request below and give it a start and target date to put it on the roadmap."
            : "Nothing scheduled matches these filters."}
        </div>
      ) : (
        <div
          ref={scrollerRef}
          className="relative max-h-[72vh] overflow-auto rounded-lg border bg-card"
        >
          <div className="relative" style={{ width: LABEL_W + trackW }}>
            {/* Scale — sticks to the top while rows scroll under it */}
            <div className="sticky top-0 z-30 flex border-b bg-card">
              <div
                className="sticky left-0 z-40 flex shrink-0 items-end border-r bg-card px-3 pb-1.5 text-xs font-medium text-muted-foreground"
                style={{ width: LABEL_W }}
              >
                Request
              </div>
              <div style={{ width: trackW }}>
                <div className="flex">
                  {quarterCells.map((q) => (
                    <div
                      key={q.key}
                      className="shrink-0 overflow-hidden whitespace-nowrap border-l px-2 pb-0.5 pt-1.5 text-xs font-semibold text-muted-foreground"
                      style={{ width: q.width }}
                    >
                      {q.key}
                    </div>
                  ))}
                </div>
                <div className="flex">
                  {months.map((m) => (
                    <div
                      key={m.at}
                      className={cn(
                        "shrink-0 overflow-hidden whitespace-nowrap border-l px-1.5 pb-1.5 text-[11px] text-muted-foreground",
                        m.month % 3 === 0 ? "border-border" : "border-border/50"
                      )}
                      style={{ width: m.days * pxPerDay }}
                    >
                      {MONTHS[m.month]}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="relative" style={{ height: layout.height }}>
              {/* Month gridlines + alternating quarter shading, one layer */}
              <div
                className="pointer-events-none absolute inset-y-0 flex"
                style={{ left: LABEL_W, width: trackW }}
                aria-hidden
              >
                {months.map((m) => (
                  <div
                    key={m.at}
                    className={cn(
                      "h-full shrink-0 border-l",
                      m.month % 3 === 0 ? "border-border" : "border-border/40",
                      Math.floor(m.month / 3) % 2 === 1 && "bg-muted/30"
                    )}
                    style={{ width: m.days * pxPerDay }}
                  />
                ))}
              </div>

              {/* Lanes + rows */}
              {layout.blocks.map(({ lane }) => (
                <React.Fragment key={lane.id}>
                  {groupBy !== "none" && (
                    <div
                      className="relative flex border-y bg-muted/60"
                      style={{ height: LANE_H }}
                    >
                      <div
                        className="sticky left-0 z-20 flex shrink-0 items-center gap-2 border-r bg-muted px-3 text-xs font-semibold"
                        style={{ width: LABEL_W }}
                      >
                        <span className="truncate">{lane.label}</span>
                        <Badge variant="secondary" className="h-5 px-1.5 tabular-nums">
                          {lane.rows.length}
                        </Badge>
                      </div>
                    </div>
                  )}
                  {lane.rows.map((it) => (
                    <RoadmapRow
                      key={it.id}
                      it={it}
                      bar={barFor(it.id)!}
                      colour={colourOf(it)}
                      xOf={xOf}
                      trackW={trackW}
                      hovered={hoverId === it.id}
                      dimmed={
                        hoverId !== null &&
                        hoverId !== it.id &&
                        !(blockersOf.get(hoverId) ?? []).includes(it.id) &&
                        !(blockingOf.get(hoverId) ?? []).includes(it.id)
                      }
                      conflict={conflictIds.has(it.id)}
                      overrun={overrunIds.has(it.id)}
                      blockers={(blockersOf.get(it.id) ?? []).length}
                      onHover={setHoverId}
                      onOpen={() => setSelectedId(it.id)}
                      onPointerDown={(e) => onBarPointerDown(e, it)}
                      onPointerMove={onBarPointerMove}
                      onPointerUp={() => onBarPointerUp(it)}
                      onClick={(e) => onBarClick(e, it)}
                      onKeyDown={(e) => onBarKeyDown(e, it)}
                    />
                  ))}
                </React.Fragment>
              ))}

              {/* Dependency links, drawn over the grid and under the bars */}
              {drawnLinks.length > 0 && (
                <LinkLayer
                  links={drawnLinks}
                  rowY={layout.rowY}
                  barFor={barFor}
                  xOf={xOf}
                  width={trackW}
                  height={layout.height}
                  hoverId={hoverId}
                />
              )}

              {/* Today */}
              {todayX >= 0 && todayX <= trackW && (
                <div
                  className="pointer-events-none absolute inset-y-0 z-[3] border-l border-dashed border-destructive/70"
                  style={{ left: LABEL_W + todayX }}
                  title="Today"
                  aria-hidden
                />
              )}
            </div>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {canScheduleAny
          ? "Drag a bar to move it, drag an end to change its length, or focus a bar and use the arrow keys (shift to stretch). Changes save as you make them and show in the request's activity."
          : "Dates are set by the team that owns each workstream. Click any bar for the details."}
      </p>

      {/* Unscheduled */}
      {unscheduled.length > 0 && (
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
            Not scheduled yet
            <Badge variant="secondary" className="tabular-nums">
              {unscheduled.length}
            </Badge>
          </h2>
          <div className="divide-y rounded-lg border bg-card">
            {unscheduled.map((it) => (
              <div key={it.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => setSelectedId(it.id)}
                    className="text-left font-medium hover:underline"
                  >
                    {it.title || "Untitled request"}
                  </button>
                  <p className="text-xs text-muted-foreground">
                    {[it.product?.name ?? "No workstream", it.project?.name, it.deadline && `needed by ${fmtDay(parseDay(it.deadline)!)}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                {it.status && (
                  <Badge style={{ backgroundColor: it.status.color, color: "white" }}>
                    {it.status.label}
                  </Badge>
                )}
                {it.canSchedule && (
                  <Button size="sm" variant="outline" onClick={() => setSelectedId(it.id)}>
                    Schedule
                  </Button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <ScheduleDialog
        key={
          selected
            ? `${selected.id}:${scheduleOf(selected).startDate}:${scheduleOf(selected).targetDate}`
            : "closed"
        }
        item={selected}
        schedule={selected ? scheduleOf(selected) : null}
        bar={selected ? barById.get(selected.id) ?? null : null}
        blockers={(selected ? blockersOf.get(selected.id) ?? [] : []).map((id) => byId.get(id)!)}
        blocking={(selected ? blockingOf.get(selected.id) ?? [] : []).map((id) => byId.get(id)!)}
        links={allLinks}
        onClose={() => setSelectedId(null)}
        onOpenOther={(id) => setSelectedId(id)}
        onSave={async (s) => {
          if (!selected) return;
          await commit(selected.id, s);
          setSelectedId(null);
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Row
// ---------------------------------------------------------------------------

function RoadmapRow({
  it,
  bar,
  colour,
  xOf,
  trackW,
  hovered,
  dimmed,
  conflict,
  overrun,
  blockers,
  onHover,
  onOpen,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onClick,
  onKeyDown,
}: {
  it: RoadmapItem;
  bar: RoadmapBar;
  colour: string;
  xOf: (ms: number) => number;
  trackW: number;
  hovered: boolean;
  dimmed: boolean;
  conflict: boolean;
  overrun: boolean;
  blockers: number;
  onHover: (id: string | null) => void;
  onOpen: () => void;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: () => void;
  onClick: (e: React.MouseEvent) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}) {
  const left = xOf(bar.start);
  const width = Math.max(xOf(bar.end) - left, 10);
  const done = it.status?.terminal ?? false;
  const provisional = bar.basis !== "planned";
  const due = parseDay(it.deadline);
  const dueX = due !== null ? xOf(due) : null;
  const when = `${fmtDay(bar.start)} → ${fmtDay(bar.end)}`;

  return (
    <div
      className={cn("relative flex border-b border-border/60 transition-opacity", dimmed && "opacity-40")}
      style={{ height: ROW_H }}
      onMouseEnter={() => onHover(it.id)}
      onMouseLeave={() => onHover(null)}
    >
      {/* Label column */}
      <div
        className={cn(
          "sticky left-0 z-20 flex shrink-0 items-center gap-2 border-r bg-card px-3",
          hovered && "bg-accent"
        )}
        style={{ width: LABEL_W, boxShadow: `inset 3px 0 0 ${colour}` }}
      >
        <button
          type="button"
          onClick={onOpen}
          className="min-w-0 flex-1 text-left"
          title={it.title}
        >
          <span className="block truncate text-[13px] font-medium leading-tight">
            {it.title || "Untitled request"}
          </span>
          <span className="block truncate text-[11px] text-muted-foreground">
            {[it.product?.name, it.owner].filter(Boolean).join(" · ") || "No workstream"}
          </span>
        </button>
        {conflict && (
          <AlertTriangle
            className="h-3.5 w-3.5 shrink-0 text-destructive"
            aria-label="Starts before a blocker finishes"
          />
        )}
        {blockers > 0 && !conflict && (
          <GitBranch
            className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
            aria-label={`Waits on ${blockers}`}
          />
        )}
        <Link
          href={it.href}
          className="shrink-0 text-muted-foreground hover:text-foreground"
          aria-label={`Open ${it.title}`}
          title="Open the request"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Track */}
      <div className="relative" style={{ width: trackW }}>
        {/* Requester's needed-by date */}
        {dueX !== null && dueX >= 0 && dueX <= trackW && (
          <span
            className={cn(
              "pointer-events-none absolute z-[2] h-2.5 w-2.5 -translate-x-1/2 rotate-45 border",
              overrun
                ? "border-amber-600 bg-amber-500"
                : "border-muted-foreground/60 bg-background"
            )}
            style={{ left: dueX, top: ROW_H / 2 - 5 }}
            title={`Requester needs it by ${fmtDay(due!)}`}
            aria-hidden
          />
        )}

        <div
          role="button"
          tabIndex={0}
          aria-label={`${it.title}, ${when}${it.canSchedule ? ". Drag to reschedule, or use the arrow keys." : ""}`}
          title={`${it.title} — ${when}${provisional ? " (one date set; the other is implied)" : ""}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onClick={onClick}
          onKeyDown={onKeyDown}
          className={cn(
            "absolute z-[4] flex touch-none select-none items-center overflow-hidden rounded-md border text-[11.5px] font-semibold outline-none",
            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            it.canSchedule ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
            provisional && "border-dashed",
            hovered && "shadow-md"
          )}
          style={{
            left,
            width,
            top: (ROW_H - BAR_H) / 2,
            height: BAR_H,
            borderColor: colour,
            background: done
              ? colour
              : `color-mix(in srgb, ${colour} 18%, transparent)`,
            color: done ? "white" : undefined,
          }}
        >
          {it.canSchedule && (
            <span
              data-handle="start"
              className="absolute inset-y-0 left-0 w-2 cursor-ew-resize"
              aria-hidden
            />
          )}
          <span className="pointer-events-none truncate px-2">{it.title}</span>
          {it.canSchedule && (
            <span
              data-handle="end"
              className="absolute inset-y-0 right-0 w-2 cursor-ew-resize"
              aria-hidden
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dependency links
// ---------------------------------------------------------------------------

function LinkLayer({
  links,
  rowY,
  barFor,
  xOf,
  width,
  height,
  hoverId,
}: {
  links: DependencyLink[];
  rowY: Map<string, number>;
  barFor: (id: string) => RoadmapBar | null;
  xOf: (ms: number) => number;
  width: number;
  height: number;
  hoverId: string | null;
}) {
  return (
    <svg
      className="pointer-events-none absolute top-0 z-[3]"
      style={{ left: LABEL_W }}
      width={width}
      height={height}
      aria-hidden
    >
      <defs>
        <marker id="rm-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="currentColor" className="text-muted-foreground" />
        </marker>
        <marker id="rm-arrow-bad" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="currentColor" className="text-destructive" />
        </marker>
      </defs>
      {links.map((l) => {
        const a = barFor(l.from);
        const b = barFor(l.to);
        const ya = rowY.get(l.from);
        const yb = rowY.get(l.to);
        if (!a || !b || ya === undefined || yb === undefined) return null;
        const x1 = xOf(a.end);
        const y1 = ya + ROW_H / 2;
        const x2 = xOf(b.start);
        const y2 = yb + ROW_H / 2;
        // Forward links get a gentle S-curve. A backward link (the conflict
        // case) loops out to the right and back so it's visibly "wrong".
        const bend = Math.max(24, Math.abs(x2 - x1) / 2);
        const d =
          x2 >= x1 + 12
            ? `M${x1},${y1} C${x1 + bend},${y1} ${x2 - bend},${y2} ${x2},${y2}`
            : `M${x1},${y1} C${x1 + 40},${y1} ${x2 - 40},${y2} ${x2},${y2}`;
        const active = hoverId === l.from || hoverId === l.to;
        return (
          <path
            key={`${l.from}>${l.to}`}
            d={d}
            fill="none"
            strokeWidth={active ? 2 : 1.25}
            strokeDasharray={l.conflict ? "4 3" : undefined}
            markerEnd={`url(#${l.conflict ? "rm-arrow-bad" : "rm-arrow"})`}
            className={cn(
              "stroke-current transition-opacity",
              l.conflict ? "text-destructive" : "text-muted-foreground",
              hoverId && !active ? "opacity-20" : "opacity-80"
            )}
          />
        );
      })}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Details + scheduling dialog
// ---------------------------------------------------------------------------

function ScheduleDialog({
  item,
  schedule,
  bar,
  blockers,
  blocking,
  links,
  onClose,
  onOpenOther,
  onSave,
}: {
  item: RoadmapItem | null;
  schedule: Schedule | null;
  bar: RoadmapBar | null;
  blockers: RoadmapItem[];
  blocking: RoadmapItem[];
  links: DependencyLink[];
  onClose: () => void;
  onOpenOther: (id: string) => void;
  onSave: (s: Schedule) => Promise<void>;
}) {
  // The parent keys this component on the request + its dates, so the inputs
  // start from the current schedule each time it opens.
  const [start, setStart] = React.useState(schedule?.startDate ?? "");
  const [target, setTarget] = React.useState(schedule?.targetDate ?? "");
  const [saving, setSaving] = React.useState(false);

  if (!item) return null;
  const invalid = Boolean(start && target && start > target);
  const conflictWith = new Set(
    links.filter((l) => l.to === item.id && l.conflict).map((l) => l.from)
  );
  const overrun = !item.status?.terminal && overrunsDeadline(bar, item.deadline);

  async function save(s: Schedule) {
    setSaving(true);
    try {
      await onSave(s);
    } finally {
      setSaving(false);
    }
  }

  const facts: [string, React.ReactNode][] = [
    ["Workstream", item.product?.name ?? "—"],
    ["Project", item.project?.name ?? "—"],
    ["Requesting team", item.team?.name ?? "—"],
    ["Owner", item.owner ?? "Not assigned"],
    ["Requested by", item.author ?? "—"],
    ["Needed by", item.deadline ? fmtDay(parseDay(item.deadline)!) : "No date given"],
    ["Supporters", item.supporters ? `+${item.supporters}` : "—"],
  ];

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="pr-6 leading-snug">{item.title || "Untitled request"}</DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-2">
            {item.status ? (
              <Badge style={{ backgroundColor: item.status.color, color: "white" }}>
                {item.status.label}
              </Badge>
            ) : (
              <Badge variant="secondary">No status</Badge>
            )}
            <span>
              {bar
                ? `${fmtDay(bar.start)} → ${fmtDay(bar.end)}${bar.basis !== "planned" ? " (partly implied)" : ""}`
                : "Not scheduled"}
            </span>
          </DialogDescription>
        </DialogHeader>

        {(conflictWith.size > 0 || overrun) && (
          <div className="space-y-1 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            {conflictWith.size > 0 && (
              <p className="flex gap-2 text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                Planned to start before{" "}
                {conflictWith.size === 1 ? "its blocker finishes" : `${conflictWith.size} of its blockers finish`}.
              </p>
            )}
            {overrun && (
              <p className="flex gap-2 text-amber-700 dark:text-amber-400">
                <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" />
                The plan lands after the date the requester asked for.
              </p>
            )}
          </div>
        )}

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          {facts.map(([k, v]) => (
            <React.Fragment key={k}>
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="min-w-0 truncate">{v}</dd>
            </React.Fragment>
          ))}
        </dl>

        {(blockers.length > 0 || blocking.length > 0) && (
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            {blockers.length > 0 && (
              <DepList
                title="Waits on"
                rows={blockers}
                flagged={conflictWith}
                onOpen={onOpenOther}
              />
            )}
            {blocking.length > 0 && (
              <DepList title="Blocks" rows={blocking} onOpen={onOpenOther} />
            )}
          </div>
        )}

        {item.canSchedule ? (
          <div className="space-y-2 border-t pt-4">
            <p className="text-sm font-medium">Planned delivery</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="rm-start">Start</Label>
                <Input id="rm-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="rm-target">Target</Label>
                <Input id="rm-target" type="date" value={target} onChange={(e) => setTarget(e.target.value)} />
              </div>
            </div>
            {invalid && (
              <p className="text-xs text-destructive">The start must be on or before the target.</p>
            )}
            <p className="text-xs text-muted-foreground">
              This is your team&rsquo;s plan. The requester&rsquo;s own date stays as it is and shows as the diamond on the row.
            </p>
          </div>
        ) : (
          <p className="border-t pt-4 text-xs text-muted-foreground">
            Only the team that owns this workstream can change its dates.
          </p>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button asChild variant="link" className="px-0">
            <Link href={item.href}>Open the request</Link>
          </Button>
          {item.canSchedule && (
            <div className="flex gap-2">
              {(schedule?.startDate || schedule?.targetDate) && (
                <Button
                  variant="ghost"
                  disabled={saving}
                  onClick={() => save({ startDate: null, targetDate: null })}
                >
                  Unschedule
                </Button>
              )}
              <Button
                disabled={saving || invalid || (!start && !target)}
                onClick={() => save({ startDate: start || null, targetDate: target || null })}
              >
                {saving ? "Saving…" : "Save dates"}
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DepList({
  title,
  rows,
  flagged,
  onOpen,
}: {
  title: string;
  rows: RoadmapItem[];
  flagged?: Set<string>;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <ul className="space-y-0.5">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center gap-1.5">
            {flagged?.has(r.id) && <AlertTriangle className="h-3 w-3 shrink-0 text-destructive" />}
            <button type="button" onClick={() => onOpen(r.id)} className="truncate text-left hover:underline">
              {r.title || "Untitled request"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toolbar bits
// ---------------------------------------------------------------------------

function ToolbarSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Record<string, string>;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 w-[170px]" aria-label={label}>
          <SelectValue>{options[value]}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {Object.entries(options).map(([k, v]) => (
            <SelectItem key={k} value={k}>
              {v}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function Segmented({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Record<string, string>;
  ariaLabel: string;
}) {
  return (
    <div role="group" aria-label={ariaLabel} className="flex overflow-hidden rounded-md border">
      {Object.entries(options).map(([k, v]) => (
        <button
          key={k}
          type="button"
          aria-pressed={value === k}
          onClick={() => onChange(k)}
          className={cn(
            "h-9 px-3 text-sm transition-colors",
            value === k ? "bg-foreground text-background" : "text-muted-foreground hover:bg-accent"
          )}
        >
          {v}
        </button>
      ))}
    </div>
  );
}

function Chip({
  pressed,
  onClick,
  tone,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  tone?: "warn";
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
        pressed
          ? tone === "warn"
            ? "border-destructive bg-destructive text-destructive-foreground"
            : "border-foreground bg-foreground text-background"
          : "bg-card text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

function Legend({
  colourBy,
  items,
  statuses,
}: {
  colourBy: ColourKey;
  items: RoadmapItem[];
  statuses: RoadmapStatus[];
}) {
  let swatches: { key: string; label: string; colour: string }[];
  if (colourBy === "status") {
    swatches = statuses.map((s) => ({ key: s.id, label: s.label, colour: s.color }));
  } else {
    const seen = new Map<string, string>();
    for (const it of items) {
      const ref = colourBy === "product" ? it.product : colourBy === "project" ? it.project : it.team;
      if (ref && !seen.has(ref.id)) seen.set(ref.id, ref.name);
    }
    swatches = Array.from(seen, ([id, name]) => ({ key: id, label: name, colour: hashColour(id) }));
  }

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 rounded-lg border bg-card px-4 py-2.5 text-xs text-muted-foreground">
      <span className="font-semibold uppercase tracking-wide">{COLOUR_LABEL[colourBy]}</span>
      {swatches.slice(0, 12).map((s) => (
        <span key={s.key} className="inline-flex items-center gap-1.5">
          <i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.colour }} />
          {s.label}
        </span>
      ))}
      {swatches.length > 12 && <span>+{swatches.length - 12} more</span>}
      <span className="mx-1 h-4 w-px bg-border" aria-hidden />
      <span className="inline-flex items-center gap-1.5">
        <i className="inline-block h-2.5 w-4 rounded-sm border border-dashed border-muted-foreground" />
        one date set
      </span>
      <span className="inline-flex items-center gap-1.5">
        <i className="inline-block h-2 w-2 rotate-45 border border-muted-foreground/60" />
        requester&rsquo;s date
      </span>
      <span className="inline-flex items-center gap-1.5">
        <i className="inline-block h-2 w-2 rotate-45 bg-amber-500" />
        plan lands after it
      </span>
      <span className="inline-flex items-center gap-1.5 text-destructive">
        <i className="inline-block w-4 border-t border-dashed border-destructive" />
        starts before its blocker ends
      </span>
    </div>
  );
}
