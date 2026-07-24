"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setMemberSlackId } from "../actions";

interface MemberSlackIdControlsProps {
  profileId: string;
  slackUserId: string | null;
}

/**
 * Inline view/edit of a member's Slack member ID (e.g. U0123ABCD), used for
 * Slack DMs. Shows the current value (or "—") with an Edit affordance that
 * swaps in a small input; clearing it stores null.
 */
export function MemberSlackIdControls({
  profileId,
  slackUserId,
}: MemberSlackIdControlsProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(slackUserId ?? "");
  const [current, setCurrent] = useState(slackUserId);
  const [isPending, startTransition] = useTransition();

  function save() {
    const trimmed = value.trim();
    startTransition(async () => {
      try {
        await setMemberSlackId(profileId, trimmed.length > 0 ? trimmed : null);
        setCurrent(trimmed.length > 0 ? trimmed : null);
        setEditing(false);
        toast.success("Slack ID updated");
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to update Slack ID";
        toast.error(message);
      }
    });
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <span
          className={
            current
              ? "font-mono text-xs"
              : "text-xs text-muted-foreground"
          }
        >
          {current || "—"}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setValue(current ?? "");
            setEditing(true);
          }}
        >
          Edit
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="U0123ABCD"
        className="h-8 w-32 font-mono text-xs"
        disabled={isPending}
        autoFocus
      />
      <Button size="sm" onClick={save} disabled={isPending}>
        {isPending ? "Saving..." : "Save"}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setEditing(false)}
        disabled={isPending}
      >
        Cancel
      </Button>
    </div>
  );
}
