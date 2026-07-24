"use client";

import * as React from "react";
import Link from "next/link";
import { FolderKanban, Layers, Lock, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  DEMO_PROJECTS,
  DEMO_ME_ID,
  type DemoProject,
} from "@/lib/demo-data";

// Demo Projects browser — mirrors components/projects-browser.tsx but renders
// only static fictional data (no Supabase, no props). Shown to a demo-mode
// admin from app/(app)/projects/page.tsx.

type Tab = "mine" | "all";

const projects = DEMO_PROJECTS;

export function DemoProjects() {
  const [tab, setTab] = React.useState<Tab>("mine");
  const [query, setQuery] = React.useState("");

  const mineCount = projects.filter((p) => p.ownerId === DEMO_ME_ID).length;

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects
      .filter((p) => (tab === "mine" ? p.ownerId === DEMO_ME_ID : true))
      .filter((p) => {
        if (q.length === 0) return true;
        return (
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.owner.email.toLowerCase().includes(q)
        );
      });
  }, [tab, query]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
            <Badge variant="secondary">Demo</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Group requests to different teams under one project and track them
            together.
          </p>
        </div>
      </header>

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
                  ? "You haven't created any projects yet."
                  : "No projects yet."}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => (
              <ProjectCardLink key={p.id} project={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ProjectCardLink({ project: p }: { project: DemoProject }) {
  return (
    <Link href={`/projects/${p.id}`} className="group">
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
            <Badge variant="secondary" className="shrink-0 gap-1 tabular-nums">
              <Layers className="h-3 w-3" />
              {p.requestIds.length}
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
            <span className="truncate">{p.owner.email}</span>
            <span>·</span>
            <span className="whitespace-nowrap">updated {p.updatedAt}</span>
          </p>
        </CardContent>
      </Card>
    </Link>
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
