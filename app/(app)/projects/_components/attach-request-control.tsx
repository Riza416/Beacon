"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setRequestProject } from "../actions";

interface AttachableRequest {
  id: string;
  title: string;
  productName: string | null;
}

/** Attach one of the user's other requests to this project. */
export function AttachRequestControl({
  projectId,
  candidates,
}: {
  projectId: string;
  candidates: AttachableRequest[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (candidates.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        All of your requests are already in this project, or you have none to
        add. New requests you create from here land in this project
        automatically.
      </p>
    );
  }

  function attach() {
    if (!selected) return;
    const id = selected;
    startTransition(async () => {
      try {
        await setRequestProject(id, projectId);
        toast.success("Request added to project");
        setSelected(null);
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not add request"
        );
      }
    });
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Select
        value={selected ?? ""}
        onValueChange={(v) => setSelected(v)}
        disabled={isPending}
      >
        <SelectTrigger className="w-full sm:w-96">
          <SelectValue placeholder="Add an existing request…" />
        </SelectTrigger>
        <SelectContent>
          {candidates.map((r) => (
            <SelectItem key={r.id} value={r.id}>
              {r.title || "Untitled draft"}
              {r.productName ? ` · ${r.productName}` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!selected || isPending}
        onClick={attach}
      >
        <Plus className="mr-1.5 h-4 w-4" />
        Add
      </Button>
    </div>
  );
}
