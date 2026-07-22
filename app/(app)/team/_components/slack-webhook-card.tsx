"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setTeamSlackWebhook } from "@/app/(app)/team/actions";

export function SlackWebhookCard({
  teamId,
  initialConfigured,
}: {
  teamId: string;
  initialConfigured: boolean;
}) {
  const router = useRouter();
  const [configured, setConfigured] = React.useState(initialConfigured);
  const [value, setValue] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  function save() {
    if (!value.trim()) {
      toast.error("Paste a Slack webhook URL first");
      return;
    }
    startTransition(async () => {
      try {
        const res = await setTeamSlackWebhook(teamId, value);
        setConfigured(res.configured);
        setValue("");
        toast.success("Slack alerts connected");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't save");
      }
    });
  }

  function remove() {
    startTransition(async () => {
      try {
        await setTeamSlackWebhook(teamId, "");
        setConfigured(false);
        setValue("");
        toast.success("Slack alerts disconnected");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't remove");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>Slack alerts</CardTitle>
          {configured ? (
            <Badge>Connected</Badge>
          ) : (
            <Badge variant="outline">Not set</Badge>
          )}
        </div>
        <CardDescription>
          Post an alert to this team&apos;s Slack channel when a request is
          submitted into — or changes status in — a workstream your team owns.
          Create an{" "}
          <a
            href="https://api.slack.com/messaging/webhooks"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            incoming webhook
          </a>{" "}
          for the channel and paste its URL.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="slack-webhook">
            {configured ? "Replace webhook URL" : "Webhook URL"}
          </Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="slack-webhook"
              type="url"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="https://hooks.slack.com/services/…"
              disabled={pending}
            />
            <Button onClick={save} disabled={pending || !value.trim()}>
              {pending ? "Saving…" : configured ? "Replace" : "Connect"}
            </Button>
          </div>
        </div>
        {configured && (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={remove}
            disabled={pending}
          >
            Disconnect Slack
          </Button>
        )}
        <p className="text-xs text-muted-foreground">
          The URL is stored securely and never shown again. Email alerts (if
          configured) continue independently.
        </p>
      </CardContent>
    </Card>
  );
}
