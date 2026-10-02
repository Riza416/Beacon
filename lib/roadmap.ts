// Roadmap: turning requests into timeline bars.
//
// Pure functions only — no React, no Supabase — so the date arithmetic that
// decides where a bar lands can be tested directly (tests/roadmap.test.ts).
//
// Three dates matter and they are deliberately NOT the same thing:
//
//   start_date .. target_date   the owning team's plan      -> the bar
//   deadline                    what the requester asked    -> the marker
//
// A request with neither plan date is "unscheduled": it is listed, but it is
// never drawn at an invented position. Guessing dates on a roadmap is how a
// roadmap stops being believed.

/** A day, as `YYYY-MM-DD`. The DB columns are plain `date`. */
export type DayString = string;

export const DAY_MS = 86_400_000;

/** Parse `YYYY-MM-DD` as a UTC midnight timestamp. `null` if unparseable. */
export function parseDay(value: string | null | undefined): number | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return null;
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(ms) ? null : ms;
}

/** Format a UTC timestamp back to `YYYY-MM-DD`. */
export function toDay(ms: number): DayString {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(ms: number, days: number): number {
  return ms + days * DAY_MS;
}

/** Whole days between two timestamps (b - a), rounded. */
export function daysBetween(a: number, b: number): number {
  return Math.round((b - a) / DAY_MS);
}

// ---------------------------------------------------------------------------
// Bars
// ---------------------------------------------------------------------------

/** How a bar's span was arrived at — drives the "provisional" styling. */
export type BarBasis = "planned" | "from-start" | "from-target";

export interface RoadmapBar {
  start: number;
  end: number;
  basis: BarBasis;
}

/**
 * How long a bar runs when only one end is pinned. Two weeks: long enough to
 * be visible at quarter zoom, short enough that nobody mistakes it for a
 * considered estimate.
 */
export const IMPLIED_SPAN_DAYS = 14;

/** The shortest bar we draw, so a same-day span is still clickable. */
export const MIN_SPAN_DAYS = 1;

/**
 * Resolve a request's bar.
 *
 * - both dates      -> exactly that span (`planned`)
 * - start only      -> start, running two weeks forward (`from-start`)
 * - target only     -> target, running two weeks back (`from-target`)
 * - neither         -> null: unscheduled, and not drawn
 *
 * An inverted span (target before start) is normalised rather than rejected,
 * so a typo shows up as a short bar you can drag instead of a missing row.
 */
export function resolveBar(input: {
  start_date?: string | null;
  target_date?: string | null;
}): RoadmapBar | null {
  const start = parseDay(input.start_date);
  const target = parseDay(input.target_date);

  if (start !== null && target !== null) {
    const lo = Math.min(start, target);
    const hi = Math.max(start, target);
    return {
      start: lo,
      end: Math.max(hi, addDays(lo, MIN_SPAN_DAYS)),
      basis: "planned",
    };
  }
  if (start !== null) {
    return {
      start,
      end: addDays(start, IMPLIED_SPAN_DAYS),
      basis: "from-start",
    };
  }
  if (target !== null) {
    return {
      start: addDays(target, -IMPLIED_SPAN_DAYS),
      end: target,
      basis: "from-target",
    };
  }
  return null;
}

/** True when the plan lands after the date the requester asked for. */
export function overrunsDeadline(
  bar: RoadmapBar | null,
  deadline: string | null | undefined
): boolean {
  const due = parseDay(deadline);
  if (bar === null || due === null) return false;
  return bar.end > due;
}

// ---------------------------------------------------------------------------
// Window
// ---------------------------------------------------------------------------

export interface RoadmapWindow {
  /** First day drawn (UTC midnight, always the 1st of a month). */
  from: number;
  /** Last day drawn (exclusive, the 1st of a month). */
  to: number;
}

function monthStart(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}

function addMonths(ms: number, n: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1);
}

/**
 * The span the chart covers: every bar, plus `today`, padded to whole months
 * with a month of breathing room each side. Falls back to a six-month window
 * around today when nothing is scheduled, so the empty chart still reads as a
 * calendar rather than a blank box.
 */
export function windowFor(bars: RoadmapBar[], today: number): RoadmapWindow {
  if (bars.length === 0) {
    return { from: addMonths(monthStart(today), -1), to: addMonths(monthStart(today), 5) };
  }
  let lo = today;
  let hi = today;
  for (const b of bars) {
    if (b.start < lo) lo = b.start;
    if (b.end > hi) hi = b.end;
  }
  return { from: addMonths(monthStart(lo), -1), to: addMonths(monthStart(hi), 2) };
}

export interface MonthCell {
  /** First day of the month (UTC). */
  at: number;
  /** Days in the month — the cell's width in day units. */
  days: number;
  year: number;
  /** 0-indexed. */
  month: number;
  /** 1-4. */
  quarter: number;
}

/** The month columns spanning a window, left to right. */
export function monthsIn(win: RoadmapWindow): MonthCell[] {
  const out: MonthCell[] = [];
  let at = win.from;
  // Guard against a pathological window rather than spinning forever.
  for (let i = 0; i < 600 && at < win.to; i++) {
    const next = addMonths(at, 1);
    const d = new Date(at);
    out.push({
      at,
      days: daysBetween(at, next),
      year: d.getUTCFullYear(),
      month: d.getUTCMonth(),
      quarter: Math.floor(d.getUTCMonth() / 3) + 1,
    });
    at = next;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Dependencies
// ---------------------------------------------------------------------------

export interface DependencyLink {
  /** The blocker — must finish first. */
  from: string;
  /** The dependent — waits on `from`. */
  to: string;
  /** True when the dependent is planned to start before its blocker ends. */
  conflict: boolean;
}

/**
 * Dependency edges between requests that are BOTH on the chart, flagged where
 * the schedule contradicts the dependency.
 *
 * Edges pointing at something unscheduled (or filtered out) are dropped: a
 * line to nowhere is worse than no line. The caller still has the raw counts
 * for those, so "blocked by 2, one not scheduled" stays tellable.
 */
export function dependencyLinks(
  edges: { request_id: string; depends_on_id: string }[],
  bars: Map<string, RoadmapBar>
): DependencyLink[] {
  const out: DependencyLink[] = [];
  const seen = new Set<string>();
  for (const e of edges) {
    if (e.request_id === e.depends_on_id) continue;
    const dependent = bars.get(e.request_id);
    const blocker = bars.get(e.depends_on_id);
    if (!dependent || !blocker) continue;
    const key = `${e.depends_on_id}>${e.request_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      from: e.depends_on_id,
      to: e.request_id,
      conflict: dependent.start < blocker.end,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Lanes
// ---------------------------------------------------------------------------

export type LaneKey = "project" | "product" | "team" | "status" | "none";

export interface LaneGroup<T> {
  /** Stable id for the lane — `__none__` for the catch-all. */
  id: string;
  label: string;
  rows: T[];
}

export const NO_LANE = "__none__";

/**
 * Bucket rows into lanes, preserving the incoming row order inside each lane
 * (callers sort first — usually by dependency order, then by date).
 *
 * Lanes come back in first-seen order with the catch-all ("No project" and
 * friends) pushed last, so the named groups lead.
 */
export function groupIntoLanes<T>(
  rows: T[],
  keyOf: (row: T) => { id: string | null; label: string | null },
  emptyLabel: string
): LaneGroup<T>[] {
  const byId = new Map<string, LaneGroup<T>>();
  for (const row of rows) {
    const { id, label } = keyOf(row);
    const key = id ?? NO_LANE;
    let lane = byId.get(key);
    if (!lane) {
      lane = { id: key, label: key === NO_LANE ? emptyLabel : label ?? emptyLabel, rows: [] };
      byId.set(key, lane);
    }
    lane.rows.push(row);
  }
  const lanes = Array.from(byId.values());
  return lanes.sort((a, b) => (a.id === NO_LANE ? 1 : 0) - (b.id === NO_LANE ? 1 : 0));
}
