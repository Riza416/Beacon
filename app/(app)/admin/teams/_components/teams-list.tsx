"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Search, Users } from "lucide-react";

export interface TeamListItem {
  id: string;
  name: string;
  companyName: string | null;
  description: string | null;
  memberCount: number;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function TeamsList({ teams }: { teams: TeamListItem[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return teams;
    return teams.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.companyName?.toLowerCase().includes(q) ?? false)
    );
  }, [teams, query]);

  return (
    <div className="space-y-5">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search teams"
          aria-label="Search teams"
          className="h-11 w-full rounded-full border border-transparent bg-muted/60 pl-11 pr-4 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-border focus:bg-background"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 p-12 text-center text-sm text-muted-foreground">
          No teams match &ldquo;{query}&rdquo;.
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((team) => (
            <li key={team.id}>
              <Link
                href={`/admin/teams/${team.id}`}
                className="group flex h-full flex-col gap-4 rounded-2xl border border-border/60 bg-card p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:shadow-md"
              >
                <div className="flex items-center gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold tracking-tight text-primary">
                    {initials(team.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-semibold tracking-tight">
                      {team.name}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">
                      {team.companyName ?? "No company"}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
                </div>

                <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                  {team.description || "No description."}
                </p>

                <div className="mt-auto flex items-center gap-1.5 border-t border-border/60 pt-4 text-xs text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  {team.memberCount}{" "}
                  {team.memberCount === 1 ? "member" : "members"}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
