import Link from "next/link";
import { FolderKanban } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CommentBody } from "@/components/comment-body";
import {
  getDemoRequest,
  getDemoWorkstream,
  projectOfRequest,
  dependenciesOfRequest,
  statusByLabel,
} from "@/lib/demo-data";

// Demo request detail — static fictional data only, no Supabase. Rendered from
// app/(app)/requests/[id]/page.tsx for a demo-mode admin (demo-* ids). Mirrors
// the real request-detail layout: title + status/workstream badges, a linked
// project badge, summary, custom fields, and a comments thread with @mentions.

export function DemoRequestDetail({ id }: { id: string }) {
  const request = getDemoRequest(id);

  if (!request) {
    return (
      <Card>
        <CardContent className="p-10 text-center text-sm text-muted-foreground">
          Demo request not found.
        </CardContent>
      </Card>
    );
  }

  const status = statusByLabel.get(request.status);
  const workstream = getDemoWorkstream(request.workstreamId);
  const project = projectOfRequest(request.id);
  const deps = dependenciesOfRequest(request.id);
  const comments = request.comments ?? [];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {request.title}
            </h1>
            <Badge variant="secondary">Demo</Badge>
            {status && (
              <Badge style={{ backgroundColor: status.color, color: "white" }}>
                {status.label}
              </Badge>
            )}
            {workstream && <Badge variant="outline">{workstream.name}</Badge>}
            {project && (
              <Link href={`/projects/${project.id}`}>
                <Badge variant="secondary" className="gap-1 hover:bg-secondary/70">
                  <FolderKanban className="h-3 w-3" />
                  {project.name}
                </Badge>
              </Link>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            By {request.author.email}
            {request.deadline && (
              <span>
                {" · deadline "}
                <span
                  className={
                    request.overdue
                      ? "font-medium text-destructive"
                      : "font-medium"
                  }
                >
                  {request.deadline}
                </span>
              </span>
            )}
          </p>
        </div>
      </header>

      {request.summary && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{request.summary}</p>
          </CardContent>
        </Card>
      )}

      {deps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Depends on</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {deps.map((d) => (
              <Link key={d.id} href={`/requests/${d.id}`}>
                <Badge variant="secondary" className="hover:bg-secondary/70">
                  {d.title}
                </Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {request.fields.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No fields configured.
            </p>
          ) : (
            request.fields.map((f) => (
              <div key={f.label} className="space-y-1">
                <div className="text-sm font-medium">{f.label}</div>
                <p className="whitespace-pre-wrap text-sm">{f.value}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Comments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {comments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No comments yet.</p>
          ) : (
            <ul className="space-y-3">
              {comments.map((c, i) => (
                <li key={i} className="rounded-md border bg-muted/30 p-3">
                  <div className="text-xs text-muted-foreground">
                    {c.author.email} · {c.when}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm">
                    <CommentBody body={c.body} mentionNames={c.mentions ?? []} />
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
