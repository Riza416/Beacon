"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateMyProfile } from "@/app/(app)/profile/actions";

export function ProfileForm({
  fullName,
  slackUserId,
}: {
  fullName: string;
  slackUserId: string;
}) {
  const router = useRouter();
  const [name, setName] = React.useState(fullName);
  const [slackId, setSlackId] = React.useState(slackUserId);
  const [pending, startTransition] = React.useTransition();

  const dirty = name.trim() !== fullName || slackId.trim() !== slackUserId;

  function save() {
    startTransition(async () => {
      try {
        await updateMyProfile({ fullName: name, slackUserId: slackId });
        toast.success("Profile updated");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't save");
      }
    });
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="profile-name">Display name</Label>
        <Input
          id="profile-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          maxLength={120}
          disabled={pending}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="profile-slack-id">Slack member ID</Label>
        <Input
          id="profile-slack-id"
          value={slackId}
          onChange={(e) => setSlackId(e.target.value)}
          placeholder="U0123ABCD"
          maxLength={40}
          disabled={pending}
        />
        <p className="text-xs text-muted-foreground">
          In Slack, open your profile → ⋯ → &ldquo;Copy member ID&rdquo;. Beacon
          DMs you status changes and reminders when this is set — otherwise you
          get email.
        </p>
      </div>
      <Button type="submit" disabled={pending || !dirty}>
        {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
