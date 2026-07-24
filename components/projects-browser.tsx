"use client";

import * as React from "react";
import Link from "next/link";
import { FolderKanban, Layers, Lock, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { LocalTime } from "@/components/local-time";
import { cn } from "@/lib/utils";

export interface ProjectCard {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  ownerLabel: string;
  isPrivate: boolean;
  updatedAt: string;
  count: number;
}

type Tab = "mine" | "all";

export function ProjectsBrowser({
  projects,
  currentUserId,
}: {
  projects: ProjectCard[];
  currentUserId: string;
}) {
  const [tab, setTab] = React.useState<Tab>("mine");
  const [query, setQuery] = React.useState("");

  const mineCount = React.useMemo(
    () => projects.filter((p) => p.ownerId === currentUserId).length,
    [projects, currentUserId]
  );

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects
      .filter((p) => (tab === "mine" ? p.ownerId === currentUserId : true))
      .filter((p) => {
        if (q.length === 0) return true;
        return (
          p.name.toLowerCase().includes(q) ||
          (p.description ?? "").toLowerCase().includes(q) ||
          p.ownerLabel.toLowerCase().includes(q)
        );
      });
  }, [projects, tab, query, currentUserId]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border bg-card p-0.5">
          <TabButton active={tab === "mine"} onClick={() => setTab("mine")}>
            My projects
            <span className="ml-1.5 tabular-nums text-muted-foreground">
              {mineCount}
            </span>
          </TabButton>
          <TabButton active={tab === "all"} onClick={() => setTab("all")}>
            All projects
            <span className="ml-1.5 tabular-nums text-muted-foreground">
              {projects.length}
            </span>
          </TabButton>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects…"
            className="pl-9"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            {query.trim().length > 0
              ? "No projects match your search."
              : tab === "mine"
                ? "You haven't created any projects yet. Create one, then file requests under it."
                : "No projects yet."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`} className="group">
              <Card className="h-full transition-colors group-hover:border-primary/40">
                <CardContent className="flex h-full flex-col gap-3 p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      {p.isPrivate ? (
                        <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <FolderKanban className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                      <h3 className="truncate font-semibold">{p.name}</h3>
                    </div>
                    <Badge
                      variant="secondary"
                      className="shrink-0 gap-1 tabular-nums"
                    >
                      <Layers className="h-3 w-3" />
                      {p.count}
                    </Badge>
                  </div>
                  <p className="line-clamp-2 flex-1 text-sm text-muted-foreground">
                    {p.description || "No description."}
                  </p>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {p.isPrivate && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 font-medium">
                        <Lock className="h-3 w-3" /> Private
                      </span>
                    )}
                    <span className="truncate">{p.ownerLabel}</span>
                    <span>·</span>
                    <span className="whitespace-nowrap">
                      updated <LocalTime value={p.updatedAt} />
                    </span>
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}
