import { describe, expect, it } from "vitest";
import {
  DAY_MS,
  IMPLIED_SPAN_DAYS,
  dependencyLinks,
  groupIntoLanes,
  monthsIn,
  overrunsDeadline,
  parseDay,
  resolveBar,
  toDay,
  windowFor,
} from "@/lib/roadmap";

const d = (s: string) => parseDay(s)!;

describe("resolveBar", () => {
  it("uses both dates when planned", () => {
    const b = resolveBar({ start_date: "2026-10-01", target_date: "2026-10-20" })!;
    expect(b.basis).toBe("planned");
    expect(toDay(b.start)).toBe("2026-10-01");
    expect(toDay(b.end)).toBe("2026-10-20");
  });

  it("runs two weeks forward from a lone start", () => {
    const b = resolveBar({ start_date: "2026-10-01" })!;
    expect(b.basis).toBe("from-start");
    expect((b.end - b.start) / DAY_MS).toBe(IMPLIED_SPAN_DAYS);
  });

  it("runs two weeks back from a lone target", () => {
    const b = resolveBar({ target_date: "2026-10-15" })!;
    expect(b.basis).toBe("from-target");
    expect(toDay(b.end)).toBe("2026-10-15");
    expect(toDay(b.start)).toBe("2026-10-01");
  });

  it("returns null when unscheduled — never invents a position", () => {
    expect(resolveBar({})).toBeNull();
    expect(resolveBar({ start_date: null, target_date: null })).toBeNull();
    expect(resolveBar({ start_date: "garbage" })).toBeNull();
  });

  it("normalises an inverted span instead of dropping it", () => {
    const b = resolveBar({ start_date: "2026-10-20", target_date: "2026-10-01" })!;
    expect(toDay(b.start)).toBe("2026-10-01");
    expect(toDay(b.end)).toBe("2026-10-20");
  });

  it("gives a same-day span a visible width", () => {
    const b = resolveBar({ start_date: "2026-10-05", target_date: "2026-10-05" })!;
    expect(b.end).toBeGreaterThan(b.start);
  });

  it("accepts timestamps, reading only the date part", () => {
    expect(toDay(d("2026-10-05T23:59:00Z"))).toBe("2026-10-05");
  });
});

describe("overrunsDeadline", () => {
  const bar = resolveBar({ start_date: "2026-10-01", target_date: "2026-10-20" });
  it("flags a plan landing after the requester's date", () => {
    expect(overrunsDeadline(bar, "2026-10-10")).toBe(true);
  });
  it("is fine when the plan lands in time", () => {
    expect(overrunsDeadline(bar, "2026-10-20")).toBe(false);
    expect(overrunsDeadline(bar, "2026-11-01")).toBe(false);
  });
  it("is false without a deadline or a bar", () => {
    expect(overrunsDeadline(bar, null)).toBe(false);
    expect(overrunsDeadline(null, "2026-10-10")).toBe(false);
  });
});

describe("windowFor / monthsIn", () => {
  const today = d("2026-10-02");

  it("pads to whole months around bars and today", () => {
    const w = windowFor([resolveBar({ start_date: "2026-12-10", target_date: "2027-01-20" })!], today);
    expect(toDay(w.from)).toBe("2026-09-01");
    expect(toDay(w.to)).toBe("2027-03-01");
  });

  it("falls back to a window around today when empty", () => {
    const w = windowFor([], today);
    expect(toDay(w.from)).toBe("2026-09-01");
    expect(monthsIn(w).length).toBe(6);
  });

  it("produces contiguous months with correct lengths", () => {
    const months = monthsIn({ from: d("2026-01-01"), to: d("2026-04-01") });
    expect(months.map((m) => m.days)).toEqual([31, 28, 31]);
    expect(months.map((m) => m.quarter)).toEqual([1, 1, 1]);
  });
});

describe("dependencyLinks", () => {
  const bars = new Map([
    ["a", resolveBar({ start_date: "2026-10-01", target_date: "2026-10-10" })!],
    ["b", resolveBar({ start_date: "2026-10-11", target_date: "2026-10-20" })!],
    ["c", resolveBar({ start_date: "2026-10-05", target_date: "2026-10-12" })!],
  ]);

  it("links blockers to dependents and flags overlap", () => {
    const links = dependencyLinks(
      [
        { request_id: "b", depends_on_id: "a" },
        { request_id: "c", depends_on_id: "a" },
      ],
      bars
    );
    expect(links).toEqual([
      { from: "a", to: "b", conflict: false },
      { from: "a", to: "c", conflict: true },
    ]);
  });

  it("drops edges to anything not on the chart, self-loops and duplicates", () => {
    const links = dependencyLinks(
      [
        { request_id: "b", depends_on_id: "zzz" },
        { request_id: "a", depends_on_id: "a" },
        { request_id: "b", depends_on_id: "a" },
        { request_id: "b", depends_on_id: "a" },
      ],
      bars
    );
    expect(links).toHaveLength(1);
  });
});

describe("groupIntoLanes", () => {
  it("keeps first-seen order and pushes the catch-all last", () => {
    const rows = [
      { id: 1, p: null },
      { id: 2, p: "x" },
      { id: 3, p: "y" },
      { id: 4, p: "x" },
    ];
    const lanes = groupIntoLanes(rows, (r) => ({ id: r.p, label: r.p ? `P ${r.p}` : null }), "No project");
    expect(lanes.map((l) => l.label)).toEqual(["P x", "P y", "No project"]);
    expect(lanes[0].rows.map((r) => r.id)).toEqual([2, 4]);
  });
});
