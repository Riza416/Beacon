"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addComment } from "@/app/(app)/requests/actions";

export function CommentForm({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [body, setBody] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = body.trim();
    if (trimmed.length === 0) {
      toast.error("Comment cannot be empty");
      return;
    }
    startTransition(async () => {
      try {
        await addComment(requestId, trimmed);
        setBody("");
        toast.success("Comment posted");
        router.refresh();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Could not post comment";
        toast.error(message);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Add a comment…"
        rows={3}
        disabled={pending}
      />
      <div className="flex justify-end">
        <Button type="submit" disabled={pending || body.trim().length === 0}>
          {pending ? "Posting…" : "Post comment"}
        </Button>
      </div>
    </form>
  );
}
