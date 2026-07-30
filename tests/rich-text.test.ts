import { describe, it, expect } from "vitest";
import { parseRichText, parseInline, safeHref } from "@/lib/rich-text";

describe("safeHref", () => {
  it("allows http and https", () => {
    expect(safeHref("https://example.com/docs")).toBe(
      "https://example.com/docs"
    );
    expect(safeHref("http://example.com")).toBe("http://example.com/");
  });

  it("rejects dangerous schemes and relative URLs", () => {
    // eslint-disable-next-line no-script-url
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("data:text/html;base64,PHNjcmlwdD4=")).toBeNull();
    expect(safeHref("vbscript:msgbox(1)")).toBeNull();
    expect(safeHref("/internal/path")).toBeNull();
    expect(safeHref("example.com")).toBeNull();
    expect(safeHref("")).toBeNull();
  });
});

describe("parseInline", () => {
  it("parses bold, code, and markdown links", () => {
    const spans = parseInline(
      "see **this** and `that` and [docs](https://example.com)"
    );
    expect(spans.map((s) => s.kind)).toEqual([
      "text",
      "bold",
      "text",
      "code",
      "text",
      "link",
    ]);
    const link = spans.find((s) => s.kind === "link");
    expect(link).toEqual({
      kind: "link",
      label: "docs",
      href: "https://example.com/",
    });
  });

  it("auto-links bare http(s) URLs", () => {
    const spans = parseInline("repo at https://github.com/acme/thing ok");
    const link = spans.find((s) => s.kind === "link");
    expect(link?.kind).toBe("link");
    if (link?.kind === "link") {
      expect(link.href).toBe("https://github.com/acme/thing");
    }
  });

  it("renders an unsafe-scheme markdown link as plain text", () => {
    // The link pattern only matches http(s), so this stays literal text —
    // no anchor is ever produced for a javascript: target.
    const spans = parseInline("[click](javascript:alert(1))");
    expect(spans.every((s) => s.kind !== "link")).toBe(true);
  });

  it("leaves plain text alone", () => {
    expect(parseInline("just words")).toEqual([
      { kind: "text", text: "just words" },
    ]);
  });
});

describe("parseRichText", () => {
  it("returns no blocks for empty input", () => {
    expect(parseRichText("")).toEqual([]);
    expect(parseRichText("   \n\n  ")).toEqual([]);
  });

  it("splits paragraphs on blank lines and joins soft wraps", () => {
    const blocks = parseRichText("one\nstill one\n\ntwo");
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toEqual({
      kind: "paragraph",
      spans: [{ kind: "text", text: "one still one" }],
    });
    expect(blocks[1].kind).toBe("paragraph");
  });

  it("collapses consecutive bullets into one list", () => {
    const blocks = parseRichText("Intro:\n- first\n- second\n* third");
    expect(blocks.map((b) => b.kind)).toEqual(["paragraph", "list"]);
    const list = blocks[1];
    if (list.kind === "list") {
      expect(list.items).toHaveLength(3);
      expect(list.items[0]).toEqual([{ kind: "text", text: "first" }]);
    }
  });

  it("supports a list followed by another paragraph", () => {
    const blocks = parseRichText("- a\n- b\n\nafter");
    expect(blocks.map((b) => b.kind)).toEqual(["list", "paragraph"]);
  });

  it("parses inline spans inside list items", () => {
    const blocks = parseRichText("- see [docs](https://example.com)");
    const list = blocks[0];
    expect(list.kind).toBe("list");
    if (list.kind === "list") {
      // "see " stays text; the link follows it within the same item.
      expect(list.items[0].map((s) => s.kind)).toEqual(["text", "link"]);
    }
  });

  it("never emits raw HTML — angle brackets stay literal text", () => {
    const blocks = parseRichText("<script>alert(1)</script>");
    expect(blocks).toEqual([
      {
        kind: "paragraph",
        spans: [{ kind: "text", text: "<script>alert(1)</script>" }],
      },
    ]);
  });
});
