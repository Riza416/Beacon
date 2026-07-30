import * as React from "react";
import { cn } from "@/lib/utils";
import { parseRichText, type Inline } from "@/lib/rich-text";

/**
 * Render author-provided guidance (workstream FAQs) from lightweight markdown.
 * Builds React elements from a parsed tree — no HTML string is ever injected,
 * and only http(s) links survive parsing.
 */
export function RichText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const blocks = parseRichText(text);
  if (blocks.length === 0) return null;

  return (
    <div className={cn("space-y-2 text-sm leading-relaxed", className)}>
      {blocks.map((block, i) =>
        block.kind === "list" ? (
          <ul key={i} className="ml-4 list-disc space-y-1">
            {block.items.map((spans, j) => (
              <li key={j}>
                <Spans spans={spans} />
              </li>
            ))}
          </ul>
        ) : (
          <p key={i}>
            <Spans spans={block.spans} />
          </p>
        )
      )}
    </div>
  );
}

function Spans({ spans }: { spans: Inline[] }) {
  return (
    <>
      {spans.map((s, i) => {
        if (s.kind === "bold") {
          return (
            <strong key={i} className="font-semibold">
              {s.text}
            </strong>
          );
        }
        if (s.kind === "code") {
          return (
            <code
              key={i}
              className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]"
            >
              {s.text}
            </code>
          );
        }
        if (s.kind === "link") {
          return (
            <a
              key={i}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="text-primary underline underline-offset-2 hover:no-underline"
            >
              {s.label}
            </a>
          );
        }
        return <React.Fragment key={i}>{s.text}</React.Fragment>;
      })}
    </>
  );
}
