"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Building2, ChevronRight, Search, Users } from "lucide-react";

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

const NO_COMPANY = "__none__";

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

  // Group teams by company so each company's teams sit together in one row.
  // Companies alphabetical; the "No company" bucket comes last.
  const groups = useMemo(() => {
    const map = new Map<string, TeamListItem[]>();
    for (const t of filtered) {
      const key = t.companyName ?? NO_COMPANY;
      const arr = map.get(key) ?? [];
      arr.push(t);
      map.set(key, arr);
    }
    const named = [...map.keys()]
      .filter((k) => k !== NO_COMPANY)
      .sort((a, b) => a.localeCompare(b));
    const ordered = [...named, ...(map.has(NO_COMPANY) ? [NO_COMPANY] : [])];
    return ordered.map((key) => ({
      key,
      label: key === NO_COMPANY ? "No company" : key,
      teams: map.get(key)!,
    }));
  }, [filtered]);

  return (
    <div className="space-y-8">
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
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.key} className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold tracking-tight">
                  {group.label}
                </h3>
                <span className="text-xs text-muted-foreground">
                  {group.teams.length}
                </span>
              </div>
              <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {group.teams.map((team) => (
                  <li key={team.id}>
                    <Link
                      href={`/admin/teams/${team.id}`}
                      className="group flex h-full flex-col gap-4 rounded-2xl border border-border/60 bg-card p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:shadow-md"
                    >
                      <div className="flex items-center gap-4">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold tracking-tight text-primary">
                          {initials(team.name)}
                        </span>
                        <div className="min-w-0 flex-1 truncate text-[15px] font-semibold tracking-tight">
                          {team.name}
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
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
