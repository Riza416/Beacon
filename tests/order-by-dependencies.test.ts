import { describe, it, expect } from "vitest";
import { orderByDependencies } from "@/lib/order-by-dependencies";

type Row = { id: string };

const rows = (...ids: string[]): Row[] => ids.map((id) => ({ id }));
const ids = (out: Row[]) => out.map((r) => r.id);

describe("orderByDependencies", () => {
  it("returns an empty array for empty input", () => {
    expect(orderByDependencies([], new Map())).toEqual([]);
  });

  it("preserves original order when there are no dependencies", () => {
    const input = rows("a", "b", "c");
    expect(ids(orderByDependencies(input, new Map()))).toEqual(["a", "b", "c"]);
  });

  it("puts a blocker before its dependent (A depends on B => B before A)", () => {
    const input = rows("a", "b");
    const deps = new Map([["a", [{ id: "b" }]]]);
    expect(ids(orderByDependencies(input, deps))).toEqual(["b", "a"]);
  });

  it("sinks the dependent below its blocker while ties keep original order", () => {
    // a depends on c; b and c are free. Ready set is [b, c] in original
    // order, then a becomes ready once c is placed.
    const input = rows("a", "b", "c", "d");
    const deps = new Map([["a", [{ id: "c" }]]]);
    expect(ids(orderByDependencies(input, deps))).toEqual(["b", "c", "a", "d"]);
  });

  it("keeps every row exactly once when there is a 2-cycle", () => {
    const input = rows("x", "a", "b", "y");
    const deps = new Map([
      ["a", [{ id: "b" }]],
      ["b", [{ id: "a" }]],
    ]);
    const out = ids(orderByDependencies(input, deps));
    expect(out).toHaveLength(4);
    expect([...out].sort()).toEqual(["a", "b", "x", "y"]);
    // cycle leftovers are appended in original order after the acyclic part
    expect(out).toEqual(["x", "y", "a", "b"]);
  });

  it("ignores dependencies that point outside the row set", () => {
    const input = rows("a", "b");
    const deps = new Map([["a", [{ id: "ghost" }]]]);
    expect(ids(orderByDependencies(input, deps))).toEqual(["a", "b"]);
  });
});
