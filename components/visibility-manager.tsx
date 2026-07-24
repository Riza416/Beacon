"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search, User as UserIcon, X, Lock, Globe } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  setRequestPrivacy,
  addVisibilityGrant,
  removeVisibilityGrant,
} from "@/app/(app)/requests/actions";

export interface VisibilityProfile {
  id: string;
  full_name: string | null;
  email: string | null;
}

interface VisibilityManagerProps {
  requestId: string;
  isPrivate: boolean;
  /** The request's author id — always in the audience, shown but not removable. */
  authorId: string;
  profiles: VisibilityProfile[];
  grantedUserIds: string[];
  /** Author or admin — may toggle privacy and manage grants. */
  canManage: boolean;
}

const MAX_RESULTS = 8;

function label(p: VisibilityProfile): string {
  return p.full_name?.trim() || p.email?.trim() || p.id;
}
function subLabel(p: VisibilityProfile): string | null {
  return p.full_name && p.email ? p.email : null;
}

export function VisibilityManager({
  requestId,
  isPrivate,
  authorId,
  profiles,
  grantedUserIds,
  canManage,
}: VisibilityManagerProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  const granted = React.useMemo(
    () => new Set(grantedUserIds),
    [grantedUserIds]
  );

  const grantedProfiles = React.useMemo(
    () => profiles.filter((p) => granted.has(p.id) && p.id !== authorId),
    [profiles, granted, authorId]
  );

  const matches = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const out: VisibilityProfile[] = [];
    for (const p of profiles) {
      if (p.id === authorId) continue;
      const hay = `${p.full_name ?? ""} ${p.email ?? ""}`.toLowerCase();
      if (hay.includes(q)) out.push(p);
      if (out.length >= MAX_RESULTS) break;
    }
    return out;
  }, [profiles, query, authorId]);

  function run(msg: string, fn: () => Promise<{ ok: true }>) {
    startTransition(async () => {
      try {
        await fn();
        toast.success(msg);
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not update visibility"
        );
      }
    });
  }

  function togglePrivacy(next: boolean) {
    run(next ? "Request is now private" : "Request is now public", () =>
      setRequestPrivacy(requestId, next)
    );
  }

  function addGrant(p: VisibilityProfile) {
    if (granted.has(p.id)) return;
    setQuery("");
    run(`${label(p)} can now see this`, () =>
      addVisibilityGrant(requestId, p.id)
    );
  }

  function removeGrant(p: VisibilityProfile) {
    run(`Removed ${label(p)}`, () => removeVisibilityGrant(requestId, p.id));
  }

  // Read-only view for people who aren't the author/admin.
  if (!canManage) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        {isPrivate ? (
          <>
            <Lock className="h-4 w-4" /> Private — limited to the author,
            admins, the owning &amp; dependent teams, and people who&apos;ve
            been given access.
          </>
        ) : (
          <>
            <Globe className="h-4 w-4" /> Visible to everyone in the workspace.
          </>
        )}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3">
        <Checkbox
          checked={isPrivate}
          onCheckedChange={(c) => togglePrivacy(c === true)}
          disabled={pending}
          className="mt-0.5"
          aria-label="Make this request private"
        />
        <span className="space-y-0.5">
          <span className="flex items-center gap-1.5 text-sm font-medium">
            {isPrivate ? (
              <Lock className="h-3.5 w-3.5" />
            ) : (
              <Globe className="h-3.5 w-3.5" />
            )}
            {isPrivate ? "Private" : "Public"}
          </span>
          <span className="block text-xs text-muted-foreground">
            {isPrivate
              ? "Only you, admins, the owning + dependent teams, and people you add below can see this."
              : "Anyone in the workspace can see this request."}
          </span>
        </span>
      </label>

      {isPrivate && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            People with access
          </p>
          <ul className="flex flex-wrap gap-2">
            <li className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 py-1 pl-2.5 pr-2.5 text-xs">
              <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-medium">Author</span>
            </li>
            {grantedProfiles.map((p) => (
              <li
                key={p.id}
                className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 py-1 pl-2.5 pr-1.5 text-xs"
              >
                <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium">{label(p)}</span>
                <button
                  type="button"
                  onClick={() => removeGrant(p)}
                  disabled={pending}
                  className="ml-1 flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground disabled:opacity-50"
                  aria-label={`Remove ${label(p)}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Add a person by name or email…"
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
                matches.map((p) => {
                  const already = granted.has(p.id);
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={already || pending}
                        onClick={() => addGrant(p)}
                      >
                        <UserIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="flex-1 truncate">
                          {label(p)}
                          {subLabel(p) && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              {subLabel(p)}
                            </span>
                          )}
                        </span>
                        {already && (
                          <span className="text-xs text-muted-foreground">
                            has access
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
