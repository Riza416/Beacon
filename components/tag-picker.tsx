"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search, User as UserIcon, Users as UsersIcon, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  addTeamTag,
  addUserTag,
  removeTeamTag,
  removeUserTag,
} from "@/app/(app)/requests/actions";

export interface TagPickerProfile {
  id: string;
  full_name: string | null;
  email: string | null;
}

export interface TagPickerTeam {
  id: string;
  name: string;
}

interface TagPickerProps {
  requestId: string;
  profiles: TagPickerProfile[];
  teams: TagPickerTeam[];
  taggedUserIds: string[];
  taggedTeamIds: string[];
  canMutate: boolean;
}

type SearchHit =
  | { kind: "user"; profile: TagPickerProfile }
  | { kind: "team"; team: TagPickerTeam };

const MAX_RESULTS = 8;

function profileLabel(p: TagPickerProfile): string {
  return p.full_name?.trim() || p.email?.trim() || p.id;
}

function profileSubLabel(p: TagPickerProfile): string | null {
  if (p.full_name && p.email) return p.email;
  return null;
}

export function TagPicker({
  requestId,
  profiles,
  teams,
  taggedUserIds,
  taggedTeamIds,
  canMutate,
}: TagPickerProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  const taggedUsers = React.useMemo(
    () => new Set(taggedUserIds),
    [taggedUserIds]
  );
  const taggedTeams = React.useMemo(
    () => new Set(taggedTeamIds),
    [taggedTeamIds]
  );

  const tagged = React.useMemo(() => {
    const userChips = profiles
      .filter((p) => taggedUsers.has(p.id))
      .map((p) => ({ kind: "user" as const, profile: p }));
    const teamChips = teams
      .filter((t) => taggedTeams.has(t.id))
      .map((t) => ({ kind: "team" as const, team: t }));
    return [...teamChips, ...userChips];
  }, [profiles, teams, taggedUsers, taggedTeams]);

  const matches: SearchHit[] = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length === 0) return [];

    const out: SearchHit[] = [];
    for (const t of teams) {
      if (t.name.toLowerCase().includes(q)) {
        out.push({ kind: "team", team: t });
      }
      if (out.length >= MAX_RESULTS) break;
    }
    if (out.length < MAX_RESULTS) {
      for (const p of profiles) {
        const haystack = `${p.full_name ?? ""} ${p.email ?? ""}`.toLowerCase();
        if (haystack.includes(q)) {
          out.push({ kind: "user", profile: p });
        }
        if (out.length >= MAX_RESULTS) break;
      }
    }
    return out;
  }, [profiles, teams, query]);

  function runAction(label: string, fn: () => Promise<{ ok: true }>) {
    startTransition(async () => {
      try {
        await fn();
        toast.success(label);
        router.refresh();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Could not update tags";
        toast.error(message);
      }
    });
  }

  function addUser(p: TagPickerProfile) {
    if (taggedUsers.has(p.id)) return;
    runAction(`Tagged ${profileLabel(p)}`, () => addUserTag(requestId, p.id));
  }

  function addTeam(t: TagPickerTeam) {
    if (taggedTeams.has(t.id)) return;
    runAction(`Tagged team ${t.name}`, () => addTeamTag(requestId, t.id));
  }

  function removeUser(p: TagPickerProfile) {
    runAction(`Untagged ${profileLabel(p)}`, () =>
      removeUserTag(requestId, p.id)
    );
  }

  function removeTeam(t: TagPickerTeam) {
    runAction(`Untagged team ${t.name}`, () =>
      removeTeamTag(requestId, t.id)
    );
  }

  return (
    <div className="space-y-3">
      {tagged.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nobody tagged yet.
          {canMutate
            ? " Search below to add people or teams who should weigh in."
            : ""}
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {tagged.map((t) =>
            t.kind === "user" ? (
              <TagChip
                key={`user-${t.profile.id}`}
                icon={<UserIcon className="h-3.5 w-3.5" />}
                label={profileLabel(t.profile)}
                subLabel={profileSubLabel(t.profile)}
                onRemove={
                  canMutate && !pending ? () => removeUser(t.profile) : null
                }
              />
            ) : (
              <TagChip
                key={`team-${t.team.id}`}
                icon={<UsersIcon className="h-3.5 w-3.5" />}
                label={t.team.name}
                subLabel="team"
                onRemove={
                  canMutate && !pending ? () => removeTeam(t.team) : null
                }
              />
            )
          )}
        </ul>
      )}

      {canMutate && (
        <div className="space-y-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search people or teams…"
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
                matches.map((m) => {
                  if (m.kind === "user") {
                    const already = taggedUsers.has(m.profile.id);
                    return (
                      <li key={`u-${m.profile.id}`}>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={already || pending}
                          onClick={() => addUser(m.profile)}
                        >
                          <UserIcon className="h-4 w-4 text-muted-foreground" />
                          <span className="flex-1 truncate">
                            {profileLabel(m.profile)}
                            {profileSubLabel(m.profile) && (
                              <span className="ml-2 text-xs text-muted-foreground">
                                {profileSubLabel(m.profile)}
                              </span>
                            )}
                          </span>
                          {already && (
                            <span className="text-xs text-muted-foreground">
                              tagged
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  }
                  const already = taggedTeams.has(m.team.id);
                  return (
                    <li key={`t-${m.team.id}`}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={already || pending}
                        onClick={() => addTeam(m.team)}
                      >
                        <UsersIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="flex-1 truncate">
                          {m.team.name}
                          <span className="ml-2 text-xs text-muted-foreground">
                            team
                          </span>
                        </span>
                        {already && (
                          <span className="text-xs text-muted-foreground">
                            tagged
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

function TagChip({
  icon,
  label,
  subLabel,
  onRemove,
}: {
  icon: React.ReactNode;
  label: string;
  subLabel: string | null;
  onRemove: (() => void) | null;
}) {
  return (
    <li className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 py-1 pl-2.5 pr-1.5 text-xs">
      <span className="text-muted-foreground">{icon}</span>
      <span className="font-medium">{label}</span>
      {subLabel && (
        <span className="text-muted-foreground">· {subLabel}</span>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-1 flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground"
          aria-label={`Remove ${label}`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </li>
  );
}
