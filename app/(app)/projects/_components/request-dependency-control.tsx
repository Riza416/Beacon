"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Link2, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  setRequestDependency,
  removeRequestDependency,
} from "../actions";

interface RequestRef {
  id: string;
  title: string;
}

/**
 * Shows what a request depends on (its blockers) within a project, and — for
 * the project owner / request author / admin — lets them add or remove them.
 */
export function RequestDependencyControl({
  requestId,
  dependencies,
  candidates,
  canManage,
}: {
  requestId: string;
  dependencies: RequestRef[];
  /** Other requests in the same project that could be depended on. */
  candidates: RequestRef[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const dependencyIds = new Set(dependencies.map((d) => d.id));
  const addable = candidates.filter(
    (c) => c.id !== requestId && !dependencyIds.has(c.id)
  );

  function run(msg: string, fn: () => Promise<{ ok: true }>) {
    startTransition(async () => {
      try {
        await fn();
        toast.success(msg);
        setSelected(null);
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not update dependencies"
        );
      }
    });
  }

  if (dependencies.length === 0 && (!canManage || addable.length === 0)) {
    return null;
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
      {dependencies.length > 0 && (
        <>
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <Link2 className="h-3 w-3" />
            Depends on
          </span>
          {dependencies.map((d) => (
            <span
              key={d.id}
              className="inline-flex items-center gap-1 rounded-full border bg-muted/40 py-0.5 pl-2 pr-1"
            >
              <span className="max-w-[14rem] truncate font-medium">
                {d.title || "Untitled"}
              </span>
              {canManage && (
                <button
                  type="button"
                  onClick={() =>
                    run("Dependency removed", () =>
                      removeRequestDependency(requestId, d.id)
                    )
                  }
                  disabled={pending}
                  className="flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground disabled:opacity-50"
                  aria-label={`Remove dependency ${d.title}`}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}
        </>
      )}

      {canManage && addable.length > 0 && (
        <span className="inline-flex items-center gap-1">
          <Select
            value={selected ?? ""}
            onValueChange={(v) => setSelected(v)}
            disabled={pending}
          >
            <SelectTrigger className="h-7 w-52 text-xs">
              <SelectValue placeholder="Add a dependency…" />
            </SelectTrigger>
            <SelectContent>
              {addable.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.title || "Untitled"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2"
            disabled={!selected || pending}
            onClick={() => {
              if (selected)
                run("Dependency added", () =>
                  setRequestDependency(requestId, selected)
                );
            }}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </span>
      )}
    </div>
  );
}
