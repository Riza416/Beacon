import Link from "next/link";
import { notFound } from "next/navigation";
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
import { Button } from "@/components/ui/button";
import { AdminControls } from "@/components/admin-controls";
import { CommentForm } from "@/components/comment-form";
import { SubmitButton } from "@/components/submit-button";
import { formatDate } from "@/lib/utils";
import type {
  Comment,
  FieldDefinition,
  FieldValue,
  RequestRow,
  Status,
} from "@/lib/types";

export const dynamic = "force-dynamic";

interface RequestPageProps {
  params: Promise<{ id: string }>;
}

type CommentWithAuthor = Comment & {
  author: { full_name: string | null; email: string | null } | null;
};

type RequestWithJoins = RequestRow & {
  status: { id: string; label: string; color: string } | null;
  author: { full_name: string | null; email: string | null } | null;
};

export default async function RequestDetailPage({ params }: RequestPageProps) {
  const { id } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: request } = await supabase
    .from("requests")
    .select(
      "*, status:statuses(id, label, color), author:profiles!requests_author_id_fkey(full_name, email)"
    )
    .eq("id", id)
    .maybeSingle<RequestWithJoins>();

  if (!request) notFound();

  const { data: fields } = await supabase
    .from("request_field_definitions")
    .select("*")
    .eq("is_active", true)
    .order("display_order", { ascending: true })
    .returns<FieldDefinition[]>();

  const { data: values } = await supabase
    .from("request_field_values")
    .select("*")
    .eq("request_id", id)
    .returns<FieldValue[]>();

  const { data: comments } = await supabase
    .from("comments")
    .select(
      "*, author:profiles!comments_author_id_fkey(full_name, email)"
    )
    .eq("request_id", id)
    .order("created_at", { ascending: true })
    .returns<CommentWithAuthor[]>();

  const isAdmin = profile.role === "admin";
  const isAuthor = request.author_id === profile.id;
  const isDraft = request.state === "draft";

  // Sign URLs for any file/image fields.
  const signedUrls = new Map<string, string>();
  const filePaths: string[] = [];
  for (const v of values ?? []) {
    if (v.file_path) filePaths.push(v.file_path);
  }
  if (filePaths.length > 0) {
    const { data: signed } = await supabase.storage
      .from("request-attachments")
      .createSignedUrls(filePaths, 3600);
    for (const s of signed ?? []) {
      if (s.path && s.signedUrl) signedUrls.set(s.path, s.signedUrl);
    }
  }

  const valuesByField = new Map<string, FieldValue>();
  for (const v of values ?? []) valuesByField.set(v.field_definition_id, v);

  let statuses: Status[] = [];
  if (isAdmin) {
    const { data } = await supabase
      .from("statuses")
      .select("*")
      .order("display_order", { ascending: true })
      .returns<Status[]>();
    statuses = data ?? [];
  }

  const authorLabel =
    request.author?.full_name ??
    request.author?.email ??
    "Unknown author";

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {request.title || "Untitled draft"}
            </h1>
            {isDraft && <Badge variant="secondary">Draft</Badge>}
            {request.status && (
              <Badge
                style={{
                  backgroundColor: request.status.color,
                  color: "white",
                }}
              >
                {request.status.label}
              </Badge>
            )}
            {request.notion_url && (
              <a
                href={request.notion_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs underline text-muted-foreground"
              >
                Notion ↗
              </a>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            By {authorLabel}
            {request.submitted_at
              ? ` · submitted ${formatDate(request.submitted_at)}`
              : ` · updated ${formatDate(request.updated_at)}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAuthor && isDraft && (
            <>
              <Button asChild variant="outline">
                <Link href={`/requests/${id}/edit`}>Continue editing</Link>
              </Button>
              <SubmitButton requestId={id} />
            </>
          )}
          {!isDraft && (isAuthor || isAdmin) && (
            <Button asChild variant="ghost">
              <Link href={`/requests/${id}/edit`}>
                {isAdmin ? "Edit (admin)" : "View edit"}
              </Link>
            </Button>
          )}
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
          <CardDescription>
            Submitted answers to the request template.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {(fields ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">
              No fields configured.
            </p>
          )}
          {(fields ?? []).map((f) => {
            const v = valuesByField.get(f.id);
            return (
              <div key={f.id} className="space-y-1">
                <div className="text-sm font-medium">{f.label}</div>
                <FieldValueRenderer
                  field={f}
                  value={v}
                  signedUrls={signedUrls}
                />
              </div>
            );
          })}
        </CardContent>
      </Card>

      {isAdmin && (
        <AdminControls
          requestId={id}
          statuses={statuses}
          currentStatusId={request.status_id}
          currentNotionUrl={request.notion_url}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Comments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(comments ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No comments yet.</p>
          ) : (
            <ul className="space-y-3">
              {(comments ?? []).map((c) => (
                <li key={c.id} className="rounded-md border bg-muted/30 p-3">
                  <div className="text-xs text-muted-foreground">
                    {c.author?.full_name ?? c.author?.email ?? "Unknown"} ·{" "}
                    {formatDate(c.created_at)}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{c.body}</p>
                </li>
              ))}
            </ul>
          )}
          <CommentForm requestId={id} />
        </CardContent>
      </Card>
    </div>
  );
}

function FieldValueRenderer({
  field,
  value,
  signedUrls,
}: {
  field: FieldDefinition;
  value: FieldValue | undefined;
  signedUrls: Map<string, string>;
}) {
  if (!value) {
    return <p className="text-sm text-muted-foreground">—</p>;
  }
  switch (field.field_type) {
    case "short_text":
    case "select": {
      if (!value.value_text)
        return <p className="text-sm text-muted-foreground">—</p>;
      return <p className="text-sm">{value.value_text}</p>;
    }
    case "multi_select": {
      if (!value.value_text)
        return <p className="text-sm text-muted-foreground">—</p>;
      let selected: string[] = [];
      try {
        const parsed = JSON.parse(value.value_text);
        if (Array.isArray(parsed))
          selected = parsed.filter((x) => typeof x === "string");
      } catch {
        // fall through to empty
      }
      if (selected.length === 0)
        return <p className="text-sm text-muted-foreground">—</p>;
      return (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((s) => (
            <Badge key={s} variant="secondary">
              {s}
            </Badge>
          ))}
        </div>
      );
    }
    case "long_text": {
      if (!value.value_text)
        return <p className="text-sm text-muted-foreground">—</p>;
      return (
        <p className="whitespace-pre-wrap text-sm">{value.value_text}</p>
      );
    }
    case "url": {
      if (!value.value_text)
        return <p className="text-sm text-muted-foreground">—</p>;
      return (
        <a
          href={value.value_text}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary underline break-all"
        >
          {value.value_text}
        </a>
      );
    }
    case "checkbox": {
      return (
        <p className="text-sm">
          {value.value_text === "true" ? "Yes" : "No"}
        </p>
      );
    }
    case "file":
    case "image": {
      if (!value.file_path)
        return <p className="text-sm text-muted-foreground">—</p>;
      const url = signedUrls.get(value.file_path);
      const filename = value.file_path.split("/").pop();
      if (!url)
        return (
          <p className="text-sm text-muted-foreground">
            {filename} (link unavailable)
          </p>
        );
      if (field.field_type === "image") {
        return (
          <div className="space-y-2">
            <div className="overflow-hidden rounded-md border inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={filename ?? "attachment"}
                className="max-h-60 w-auto object-contain"
              />
            </div>
            <div>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground underline"
              >
                Open original
              </a>
            </div>
          </div>
        );
      }
      return (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary underline break-all"
        >
          {filename}
        </a>
      );
    }
    default:
      return <p className="text-sm text-muted-foreground">—</p>;
  }
}
