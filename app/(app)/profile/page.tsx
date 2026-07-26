import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LocalTime } from "@/components/local-time";
import { ProfileForm } from "@/components/profile-form";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const [
    { data: team },
    { count: submittedCount },
    { count: draftCount },
    { count: projectCount },
    { count: watchingCount },
    { count: supportedCount },
  ] = await Promise.all([
    profile.team_id
      ? supabase
          .from("teams")
          .select("id, name")
          .eq("id", profile.team_id)
          .maybeSingle<{ id: string; name: string }>()
      : Promise.resolve({ data: null }),
    supabase
      .from("requests")
      .select("id", { count: "exact", head: true })
      .eq("author_id", profile.id)
      .eq("state", "submitted"),
    supabase
      .from("requests")
      .select("id", { count: "exact", head: true })
      .eq("author_id", profile.id)
      .eq("state", "draft"),
    supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", profile.id),
    supabase
      .from("request_watchers")
      .select("request_id", { count: "exact", head: true })
      .eq("user_id", profile.id),
    supabase
      .from("request_supporters")
      .select("request_id", { count: "exact", head: true })
      .eq("user_id", profile.id),
  ]);

  const displayName = profile.full_name ?? profile.email ?? "You";
  const initial = (profile.full_name ?? profile.email ?? "?")
    .charAt(0)
    .toUpperCase();

  const stats: { label: string; value: number; href?: string }[] = [
    { label: "Submitted", value: submittedCount ?? 0, href: "/requests/mine" },
    { label: "Drafts", value: draftCount ?? 0, href: "/requests/mine" },
    { label: "Projects", value: projectCount ?? 0, href: "/projects" },
    { label: "Watching", value: watchingCount ?? 0 },
    { label: "+1s given", value: supportedCount ?? 0 },
  ];

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xl font-semibold text-primary">
          {initial}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-2xl font-semibold tracking-tight">
              {displayName}
            </h1>
            <Badge variant={profile.role === "admin" ? "default" : "secondary"}>
              {profile.role}
            </Badge>
            {team && <Badge variant="outline">{team.name}</Badge>}
          </div>
          {profile.email && (
            <p className="truncate text-sm text-muted-foreground">
              {profile.email}
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            Member since{" "}
            <LocalTime value={profile.created_at} mode="dateFull" />
          </p>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => {
          const body = (
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {s.value}
              </p>
            </CardContent>
          );
          return s.href ? (
            <Link key={s.label} href={s.href}>
              <Card className="transition-colors hover:bg-accent/50">
                {body}
              </Card>
            </Link>
          ) : (
            <Card key={s.label}>{body}</Card>
          );
        })}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            How your name shows up across Beacon, and where we DM you.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm
            fullName={profile.full_name ?? ""}
            slackUserId={profile.slack_user_id ?? ""}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>When Beacon reaches out to you.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Status changes on requests you submitted.</li>
            <li>When someone @mentions you in a comment.</li>
            <li>Activity on requests you&apos;re watching.</li>
            <li>Deadline reminders as due dates approach.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
