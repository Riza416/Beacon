import { describe, it, expect } from "vitest";
import { planRankUpdates } from "@/lib/priority";

describe("planRankUpdates", () => {
  it("returns [] for already-dense ranks", () => {
    expect(
      planRankUpdates([
        { id: "a", rank: 0 },
        { id: "b", rank: 1 },
        { id: "c", rank: 2 },
      ])
    ).toEqual([]);
  });

  it("returns only the rows whose rank changes after a single move", () => {
    // Final order after moving c (rank 2) to the top: c, a, b.
    // Every row's rank changes here, but d (already at 3) must not appear.
    expect(
      planRankUpdates([
        { id: "c", rank: 2 },
        { id: "a", rank: 0 },
        { id: "b", rank: 1 },
        { id: "d", rank: 3 },
      ])
    ).toEqual([
      { id: "c", rank: 0 },
      { id: "a", rank: 1 },
      { id: "b", rank: 2 },
    ]);
  });

  it("compacts gapped ranks to a dense sequence, changed rows only", () => {
    expect(
      planRankUpdates([
        { id: "a", rank: 0 },
        { id: "b", rank: 2 },
        { id: "c", rank: 5 },
      ])
    ).toEqual([
      { id: "b", rank: 1 },
      { id: "c", rank: 2 },
    ]);
  });

  it("returns [] for empty input", () => {
    expect(planRankUpdates([])).toEqual([]);
  });
});
