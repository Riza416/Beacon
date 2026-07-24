"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AtSign, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addComment } from "@/app/(app)/requests/actions";

export interface MentionablePerson {
  id: string;
  full_name: string | null;
  email: string | null;
}

function displayName(p: MentionablePerson): string {
  return p.full_name?.trim() || p.email?.trim() || "Unknown";
}

const MAX_RESULTS = 6;

/**
 * Detect an in-progress "@mention" immediately left of the caret: an "@" at the
 * start or after whitespace, followed by a run of non-whitespace (the query).
 */
function activeMention(
  text: string,
  caret: number
): { at: number; query: string } | null {
  const upto = text.slice(0, caret);
  const at = upto.lastIndexOf("@");
  if (at === -1) return null;
  if (at > 0 && !/\s/.test(upto[at - 1])) return null;
  const query = upto.slice(at + 1);
  if (/\s/.test(query)) return null;
  return { at, query };
}

export function CommentForm({
  requestId,
  people = [],
}: {
  requestId: string;
  people?: MentionablePerson[];
}) {
  const router = useRouter();
  const [body, setBody] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // People selected via the picker, so we can resolve @names → ids on submit.
  const [mentions, setMentions] = React.useState<MentionablePerson[]>([]);

  // Autocomplete state, driven by the caret position.
  const [menu, setMenu] = React.useState<{ at: number; query: string } | null>(
    null
  );
  const [highlight, setHighlight] = React.useState(0);

  const matches = React.useMemo(() => {
    if (!menu) return [];
    const q = menu.query.toLowerCase();
    return people
      .filter((p) => {
        const hay = `${p.full_name ?? ""} ${p.email ?? ""}`.toLowerCase();
        return q.length === 0 ? true : hay.includes(q);
      })
      .slice(0, MAX_RESULTS);
  }, [people, menu]);

  function syncMenu() {
    const el = textareaRef.current;
    if (!el) return;
    setMenu(activeMention(el.value, el.selectionStart ?? el.value.length));
    setHighlight(0);
  }

  function onChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setBody(e.target.value);
    // Defer so selectionStart reflects the new value.
    requestAnimationFrame(syncMenu);
  }

  function pick(person: MentionablePerson) {
    const el = textareaRef.current;
    if (!el || !menu) return;
    const caret = el.selectionStart ?? body.length;
    const before = body.slice(0, menu.at);
    const after = body.slice(caret);
    const token = `@${displayName(person)} `;
    const next = before + token + after;
    setBody(next);
    setMentions((prev) =>
      prev.some((m) => m.id === person.id) ? prev : [...prev, person]
    );
    setMenu(null);
    // Restore focus + place caret right after the inserted mention.
    const pos = (before + token).length;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (menu && matches.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlight((h) => (h + 1) % matches.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((h) => (h - 1 + matches.length) % matches.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        pick(matches[highlight] ?? matches[0]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMenu(null);
        return;
      }
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = body.trim();
    if (trimmed.length === 0) {
      toast.error("Comment cannot be empty");
      return;
    }
    // Only notify mentions whose "@name" is still present in the final text.
    const mentionedIds = mentions
      .filter((m) => trimmed.includes(`@${displayName(m)}`))
      .map((m) => m.id);

    startTransition(async () => {
      try {
        await addComment(requestId, trimmed, mentionedIds);
        setBody("");
        setMentions([]);
        setMenu(null);
        toast.success(
          mentionedIds.length > 0
            ? `Comment posted · ${mentionedIds.length} mentioned`
            : "Comment posted"
        );
        router.refresh();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Could not post comment";
        toast.error(message);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={body}
          onChange={onChange}
          onKeyDown={onKeyDown}
          onClick={syncMenu}
          onKeyUp={(e) => {
            // Arrow keys move the caret; keep the menu state in sync.
            if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
              syncMenu();
            }
          }}
          placeholder="Add a comment… use @ to mention someone"
          rows={3}
          disabled={pending}
        />

        {menu && matches.length > 0 && (
          <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-md border bg-popover p-1 shadow-lg">
            {matches.map((p, i) => (
              <li key={p.id}>
                <button
                  type="button"
                  // Use onMouseDown so the textarea doesn't blur before we run.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(p);
                  }}
                  onMouseEnter={() => setHighlight(i)}
                  className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm ${
                    i === highlight ? "bg-accent" : "hover:bg-accent/50"
                  }`}
                >
                  <UserIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate">
                    {displayName(p)}
                    {p.full_name && p.email && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {p.email}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <AtSign className="h-3.5 w-3.5" />
          Type @ to mention someone — they&apos;ll be notified and added to the
          request.
        </span>
        <Button type="submit" disabled={pending || body.trim().length === 0}>
          {pending ? "Posting…" : "Post comment"}
        </Button>
      </div>
    </form>
  );
}
