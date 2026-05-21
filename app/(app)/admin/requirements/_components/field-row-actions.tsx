"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { moveField, toggleFieldActive } from "../actions";

interface FieldRowActionsProps {
  fieldId: string;
  isActive: boolean;
  isFirst: boolean;
  isLast: boolean;
}

export function FieldRowActions({
  fieldId,
  isActive,
  isFirst,
  isLast,
}: FieldRowActionsProps) {
  const [isPending, startTransition] = useTransition();

  function move(direction: "up" | "down") {
    const fd = new FormData();
    fd.set("id", fieldId);
    fd.set("direction", direction);
    startTransition(async () => {
      try {
        await moveField(fd);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to reorder";
        toast.error(message);
      }
    });
  }

  function toggle() {
    const fd = new FormData();
    fd.set("id", fieldId);
    fd.set("is_active", String(!isActive));
    startTransition(async () => {
      try {
        await toggleFieldActive(fd);
        toast.success(isActive ? "Field archived" : "Field activated");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to toggle";
        toast.error(message);
      }
    });
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        variant="ghost"
        size="icon"
        disabled={isFirst || isPending}
        onClick={() => move("up")}
        aria-label="Move up"
      >
        <ArrowUp className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        disabled={isLast || isPending}
        onClick={() => move("down")}
        aria-label="Move down"
      >
        <ArrowDown className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="sm" onClick={toggle} disabled={isPending}>
        {isActive ? "Archive" : "Activate"}
      </Button>
    </div>
  );
}
