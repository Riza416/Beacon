"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { updateNotionUrl } from "@/app/(app)/requests/actions";

interface NotionUrlCardProps {
  requestId: string;
  currentNotionUrl: string | null;
}

/**
 * Notion-URL card visible to anyone who can manage the request (author or
 * admin). Lets them attach or clear a notion.so / notion.site link. The
 * resulting "View in Notion" badge is rendered in the page header (and on
 * dashboard rows) for everyone.
 */
export function NotionUrlCard({
  requestId,
  currentNotionUrl,
}: NotionUrlCardProps) {
  const router = useRouter();
  const [notion, setNotion] = React.useState<string>(currentNotionUrl ?? "");
  const [pending, startTransition] = React.useTransition();

  function onSave() {
    startTransition(async () => {
      try {
        await updateNotionUrl(requestId, notion);
        toast.success(
          notion.trim() ? "Notion link saved" : "Notion link cleared"
        );
        router.refresh();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Could not save URL";
        toast.error(message);
      }
    });
  }

  function onClear() {
    setNotion("");
    startTransition(async () => {
      try {
        await updateNotionUrl(requestId, "");
        toast.success("Notion link cleared");
        router.refresh();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Could not clear URL";
        toast.error(message);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Notion link</CardTitle>
        <CardDescription>
          Paste the Notion ticket so everyone knows where the work lives.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor={`notion-${requestId}`}>URL</Label>
          <div className="flex gap-2">
            <Input
              id={`notion-${requestId}`}
              value={notion}
              onChange={(e) => setNotion(e.target.value)}
              placeholder="https://www.notion.so/..."
              autoComplete="off"
              spellCheck={false}
            />
            <Button onClick={onSave} disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </div>
          {currentNotionUrl && (
            <div className="flex items-center justify-between gap-2 pt-1">
              <a
                href={currentNotionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary underline break-all"
              >
                <ExternalLink className="h-3 w-3" />
                Open current link
              </a>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClear}
                disabled={pending}
              >
                Clear
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
