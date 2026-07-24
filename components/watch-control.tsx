"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, EyeOff, Search, User as UserIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  watchRequest,
  unwatchRequest,
  addWatcher,
  removeWatcher,
} from "@/app/(app)/requests/actions";

export interface WatchProfile {
  id: string;
  full_name: string | null;
  email: string | null;
}

function label(p: WatchProfile): string {
  return p.full_name?.trim() || p.email?.trim() || "Unknown";
}

const MAX_RESULTS = 6;

/**
 * Watch/unwatch a request and — for the author/admin — manage who else watches.
 * Watchers get notified on status changes and deadline reminders.
 */
export function WatchControl({
  requestId,
  watching,
  watcherIds,
  profiles,
  canManage,
  currentUserId,
}: {
  requestId: string;
  watching: boolean;
  watcherIds: string[];
  profiles: WatchProfile[];
  canManage: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  const watchers = new Set(watcherIds);
  const watcherProfiles = profiles.filter((p) => watchers.has(p.id));

  const matches = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return profiles
      .filter((p) => !watchers.has(p.id))
      .filter((p) =>
        `${p.full_name ?? ""} ${p.email ?? ""}`.toLowerCase().includes(q)
      )
      .slice(0, MAX_RESULTS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profiles, query, watcherIds]);

  function run(msg: string, fn: () => Promise<{ ok: true }>) {
    startTransition(async () => {
      try {
        await fn();
        toast.success(msg);
        setQuery("");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not update");
      }
    });
  }

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant={watching ? "secondary" : "outline"}
        size="sm"
        disabled={pending}
        onClick={() =>
          watching
            ? run("Stopped watching", () => unwatchRequest(requestId))
            : run("Watching — you'll get updates", () =>
                watchRequest(requestId)
              )
        }
      >
        {watching ? (
          <>
            <EyeOff className="mr-1.5 h-4 w-4" /> Watching
          </>
        ) : (
          <>
            <Eye className="mr-1.5 h-4 w-4" /> Watch
          </>
        )}
      </Button>

      {watcherProfiles.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {watcherProfiles.map((p) => (
            <li
              key={p.id}
              className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 py-1 pl-2.5 pr-1.5 text-xs"
            >
              <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-medium">
                {label(p)}
                {p.id === currentUserId && " (you)"}
              </span>
              {(canManage || p.id === currentUserId) && (
                <button
                  type="button"
                  onClick={() =>
                    run("Removed watcher", () =>
                      p.id === currentUserId
                        ? unwatchRequest(requestId)
                        : removeWatcher(requestId, p.id)
                    )
                  }
                  disabled={pending}
                  className="ml-1 flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground disabled:opacity-50"
                  aria-label={`Remove ${label(p)}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canManage && (
        <div className="space-y-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Add a watcher by name or email…"
              className="pl-9"
              autoComplete="off"
              spellCheck={false}
              disabled={pending}
            />
          </div>
          {query.trim().length > 0 && (
            <ul className="divide-y rounded-md border bg-background">
              {matches.length === 0 ? (
                <li className="px-3 py-2 text-sm text-muted-foreground">
                  No matches.
                </li>
              ) : (
                matches.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/60 disabled:opacity-50"
                      disabled={pending}
                      onClick={() =>
                        run(`Added ${label(p)}`, () =>
                          addWatcher(requestId, p.id)
                        )
                      }
                    >
                      <UserIcon className="h-4 w-4 text-muted-foreground" />
                      <span className="flex-1 truncate">
                        {label(p)}
                        {p.full_name && p.email && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            {p.email}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
