// Lightweight markdown parsing for author-provided guidance (workstream FAQs).
//
// Deliberately NOT a full markdown implementation and deliberately NOT
// HTML-producing: the parser emits a small typed tree that the renderer turns
// into React elements, so author text can never inject markup or scripts.
// Supported: blank-line-separated paragraphs, "- " bullet lists, and inline
// **bold**, `code`, [label](url) links plus bare http(s) URLs.

export type Inline =
  | { kind: "text"; text: string }
  | { kind: "bold"; text: string }
  | { kind: "code"; text: string }
  | { kind: "link"; label: string; href: string };

export type Block =
  | { kind: "paragraph"; spans: Inline[] }
  | { kind: "list"; items: Inline[][] };

/**
 * Only http(s) links are allowed through — this is what stops `javascript:`,
 * `data:`, and other scheme-based injection from author text.
 */
export function safeHref(raw: string): string | null {
  const trimmed = raw.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;
  try {
    const u = new URL(trimmed);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

const INLINE_PATTERN =
  /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*\n]+)\*\*|`([^`\n]+)`|(https?:\/\/[^\s<>()]+)/g;

/** Parse inline spans (bold / code / links) out of one line of text. */
export function parseInline(line: string): Inline[] {
  const spans: Inline[] = [];
  let last = 0;
  for (const m of line.matchAll(INLINE_PATTERN)) {
    const at = m.index ?? 0;
    if (at > last) spans.push({ kind: "text", text: line.slice(last, at) });

    const [, linkLabel, linkHref, boldText, codeText, bareUrl] = m;
    if (linkLabel && linkHref) {
      const href = safeHref(linkHref);
      spans.push(
        href
          ? { kind: "link", label: linkLabel, href }
          : { kind: "text", text: m[0] }
      );
    } else if (boldText) {
      spans.push({ kind: "bold", text: boldText });
    } else if (codeText) {
      spans.push({ kind: "code", text: codeText });
    } else if (bareUrl) {
      const href = safeHref(bareUrl);
      spans.push(
        href
          ? { kind: "link", label: bareUrl, href }
          : { kind: "text", text: bareUrl }
      );
    }
    last = at + m[0].length;
  }
  if (last < line.length) {
    spans.push({ kind: "text", text: line.slice(last) });
  }
  return spans;
}

/**
 * Parse author text into blocks. Consecutive "- " lines collapse into one list;
 * everything else becomes paragraphs, with single newlines treated as spaces.
 */
export function parseRichText(input: string): Block[] {
  const blocks: Block[] = [];
  const chunks = (input ?? "").replace(/\r\n/g, "\n").split(/\n{2,}/);

  for (const chunk of chunks) {
    const lines = chunk
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (lines.length === 0) continue;

    let buffer: string[] = [];
    let items: Inline[][] = [];

    const flushParagraph = () => {
      if (buffer.length === 0) return;
      blocks.push({ kind: "paragraph", spans: parseInline(buffer.join(" ")) });
      buffer = [];
    };
    const flushList = () => {
      if (items.length === 0) return;
      blocks.push({ kind: "list", items });
      items = [];
    };

    for (const line of lines) {
      const bullet = /^[-*]\s+(.*)$/.exec(line);
      if (bullet) {
        flushParagraph();
        items.push(parseInline(bullet[1]));
      } else {
        flushList();
        buffer.push(line);
      }
    }
    flushParagraph();
    flushList();
  }

  return blocks;
}
