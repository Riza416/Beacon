"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export interface TeamListItem {
  id: string;
  name: string;
  companyName: string | null;
  description: string | null;
  memberCount: number;
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
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by team or company…"
          className="pl-9"
          aria-label="Filter teams"
        />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground sm:p-10">
            No teams match &ldquo;{query}&rdquo;.
          </CardContent>
        </Card>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((team) => (
            <li key={team.id}>
              <Card className="flex h-full flex-col transition-colors hover:border-primary/50">
                <CardContent className="flex flex-1 flex-col gap-3 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <Link
                      href={`/admin/teams/${team.id}`}
                      className="text-base font-semibold leading-tight tracking-tight hover:underline"
                    >
                      {team.name}
                    </Link>
                    <span
                      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground"
                      title={`${team.memberCount} ${team.memberCount === 1 ? "member" : "members"}`}
                    >
                      <Users className="h-3.5 w-3.5" />
                      {team.memberCount}
                    </span>
                  </div>

                  <div>
                    {team.companyName ? (
                      <Badge variant="secondary">{team.companyName}</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        No company
                      </span>
                    )}
                  </div>

                  <p className="line-clamp-3 text-sm text-muted-foreground">
                    {team.description || "—"}
                  </p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
