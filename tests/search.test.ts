import { describe, it, expect } from "vitest";
import {
  sanitizeSearchTerm,
  titleSummaryOrFilter,
  significantWords,
  similarityOrFilter,
} from "@/lib/search";

describe("sanitizeSearchTerm", () => {
  it("strips PostgREST-breaking characters", () => {
    expect(sanitizeSearchTerm("a,b(c)d%e_f'g\"h\\i")).toBe(
      "a b c d e f g h i"
    );
  });

  it("collapses runs of whitespace to single spaces and trims", () => {
    expect(sanitizeSearchTerm("  foo \t bar\n\nbaz  ")).toBe("foo bar baz");
  });

  it("returns an empty string for input that is only junk characters", () => {
    expect(sanitizeSearchTerm(",,(())%%__''\"\"\\\\  ")).toBe("");
  });
});

describe("titleSummaryOrFilter", () => {
  it("builds a title/summary ilike or() filter", () => {
    expect(titleSummaryOrFilter("dark mode")).toBe(
      "title.ilike.%dark mode%,summary.ilike.%dark mode%"
    );
  });

  it("returns null for empty input", () => {
    expect(titleSummaryOrFilter("")).toBeNull();
  });

  it("returns null when the term is empty after sanitizing", () => {
    expect(titleSummaryOrFilter("%%,,(())")).toBeNull();
  });
});

describe("significantWords", () => {
  it("keeps only words of 4+ characters, lowercased", () => {
    expect(significantWords("Fix the LOGIN page now")).toEqual([
      "login",
      "page",
    ]);
  });

  it("dedupes repeated words", () => {
    expect(significantWords("login login LOGIN screen")).toEqual([
      "login",
      "screen",
    ]);
  });

  it("caps the result at 4 words", () => {
    expect(
      significantWords("alpha bravo charlie delta echo foxtrot")
    ).toEqual(["alpha", "bravo", "charlie", "delta"]);
  });

  it("returns [] when nothing significant remains", () => {
    expect(significantWords("a to of %%")).toEqual([]);
  });
});

describe("similarityOrFilter", () => {
  it("emits a title+summary ilike pair per word, joined by commas", () => {
    expect(similarityOrFilter("dark mode")).toBe(
      "title.ilike.%dark%,summary.ilike.%dark%,title.ilike.%mode%,summary.ilike.%mode%"
    );
  });

  it("returns null when there are no significant words", () => {
    expect(similarityOrFilter("a b c")).toBeNull();
  });
});
