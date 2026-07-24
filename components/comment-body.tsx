import * as React from "react";

/**
 * Render a comment body, highlighting "@Name" tokens for people who were
 * mentioned on this comment. Names are matched longest-first so overlapping
 * names don't mis-highlight.
 */
export function CommentBody({
  body,
  mentionNames,
}: {
  body: string;
  mentionNames: string[];
}) {
  if (mentionNames.length === 0) return <>{body}</>;

  const escaped = mentionNames
    .filter((n) => n.length > 0)
    .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .sort((a, b) => b.length - a.length);
  if (escaped.length === 0) return <>{body}</>;

  const re = new RegExp(`@(${escaped.join("|")})`, "g");
  const parts: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    if (m.index > last) parts.push(body.slice(last, m.index));
    parts.push(
      <span
        key={`${m.index}-${m[1]}`}
        className="rounded bg-primary/10 px-1 font-medium text-primary"
      >
        @{m[1]}
      </span>
    );
    last = m.index + m[0].length;
  }
  if (last < body.length) parts.push(body.slice(last));
  return <>{parts}</>;
}
