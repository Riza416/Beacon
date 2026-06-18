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
import { NotionUrlCard } from "@/components/notion-url-card";
import { CommentForm } from "@/components/comment-form";
import { SubmitButton } from "@/components/submit-button";
import {
  TagPicker,
  type TagPickerProfile,
  type TagPickerTeam,
} from "@/components/tag-picker";
import { markTagsViewed } from "@/app/(app)/requests/actions";
import { COMMENT_SELECT, REQUEST_DETAIL_SELECT } from "@/lib/queries";
import { formatDate } from "@/lib/utils";
import type {
  Comment,
  FieldDefinition,
  FieldType,
  FieldValue,
  RequestRow,
  Status,
} from "@/lib/types";

const TYPE_CAPTIONS: Record<FieldType, string> = {
  short_text: "Short answer",
  long_text: "Detailed answer",
  url: "Link",
  file: "File",
  image: "Screenshot",
  select: "",
  multi_select: "Pick several",
  checkbox: "Yes / no",
};

function allowedTypes(f: FieldDefinition): FieldType[] {
  return f.field_types && f.field_types.length > 0
    ? f.field_types
    : [f.field_type];
}

export const dynamic = "force-dynamic";

interface RequestPageProps {
  params: Promise<{ id: string }>;
}

type CommentWithAuthor = Comment & {
  author: { full_name: string | null; email: string | null } | null;
};

type RequestWithJoins = RequestRow & {
  status: { id: string; label: string; color: string } | null;
  product: { id: string; name: string } | null;
  author: { full_name: string | null; email: string | null } | null;
};

export default async function RequestDetailPage({ params }: RequestPageProps) {
  const { id } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: request } = await supabase
    .from("requests")
    .select(REQUEST_DETAIL_SELECT)
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
    .select(COMMENT_SELECT)
    .eq("request_id", id)
    .order("created_at", { ascending: true })
    .returns<CommentWithAuthor[]>();

  // Teams that own this request's product (if any), shown next to the
  // product badge so the relationship is visible from the request.
  let productOwnerNames: string[] = [];
  if (request.product_id) {
    const { data: ownerRows } = await supabase
      .from("product_owners")
      .select("team:teams(name)")
      .eq("product_id", request.product_id)
      .returns<{ team: { name: string } | null }[]>();
    productOwnerNames = (ownerRows ?? [])
      .map((r) => r.team?.name)
      .filter((n): n is string => Boolean(n));
  }

  const isAdmin = profile.role === "admin";
  const isAuthor = request.author_id === profile.id;
  const isDraft = request.state === "draft";
  const canManageTags = isAdmin || isAuthor;

  // Existing tags on this request.
  const { data: userTagRows } = await supabase
    .from("request_collaborators")
    .select("user_id")
    .eq("request_id", id)
    .returns<{ user_id: string }[]>();
  const { data: teamTagRows } = await supabase
    .from("request_team_tags")
    .select("team_id")
    .eq("request_id", id)
    .returns<{ team_id: string }[]>();

  // All profiles + teams for the picker (every authenticated user can read
  // both tables — RLS in 0002_rls.sql).
  const { data: profileRows } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .order("full_name", { ascending: true, nullsFirst: false })
    .returns<TagPickerProfile[]>();
  const { data: teamRows } = await supabase
    .from("teams")
    .select("id, name")
    .order("name", { ascending: true })
    .returns<TagPickerTeam[]>();

  const taggedUserIds = (userTagRows ?? []).map((r) => r.user_id);
  const taggedTeamIds = (teamTagRows ?? []).map((r) => r.team_id);

  // Clear the caller's unread state for this request. Best-effort: if the
  // call fails (e.g. brief RLS hiccup) we still want to render the page, so
  // swallow the error rather than crash the route.
  try {
    await markTagsViewed(id);
  } catch {
    // ignore — the next visit will retry.
  }

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

  // Group values by field_definition_id; each field may have several values
  // (one per allowed type).
  const valuesByField = new Map<string, FieldValue[]>();
  for (const v of values ?? []) {
    const list = valuesByField.get(v.field_definition_id);
    if (list) list.push(v);
    else valuesByField.set(v.field_definition_id, [v]);
  }

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
            {request.product && (
              <Badge variant="outline">{request.product.name}</Badge>
            )}
            {productOwnerNames.length > 0 && (
              <span className="text-xs text-muted-foreground">
                owned by {productOwnerNames.join(", ")}
              </span>
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
            {request.deadline && (
              <span
                className={
                  new Date(request.deadline) < new Date()
                    ? " · text-destructive font-medium"
                    : ""
                }
              >
                {" · deadline "}
                <span
                  className={
                    new Date(request.deadline) < new Date()
                      ? "text-destructive font-medium"
                      : "font-medium"
                  }
                >
                  {new Date(request.deadline).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAuthor && isDraft && (
            <>
              <Button asChild variant="outline">
                <Link href={`/requests/${id}/edit`}>Continue editing</Link>
              </Button>
              <SubmitButton
                requestId={id}
                canSubmit={Boolean(profile.team_id)}
              />
            </>
          )}
          {!isDraft && (isAuthor || isAdmin) && (
            <Button asChild variant="outline">
              <Link href={`/requests/${id}/edit`}>
                {isAdmin && !isAuthor ? "Edit (admin)" : "Edit"}
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
            const types = allowedTypes(f);
            const activeSet = new Set(types);
            const stored = valuesByField.get(f.id) ?? [];
            const byType = new Map<FieldType, FieldValue>();
            for (const v of stored) byType.set(v.field_type, v);
            // Render in the field's configured order, then append any
            // "legacy" types still in the DB whose checkbox was un-ticked
            // since the value was collected.
            const legacyTypes = stored
              .map((v) => v.field_type)
              .filter((t) => !activeSet.has(t));
            const showSubLabels = types.length > 1 || legacyTypes.length > 0;
            return (
              <div key={f.id} className="space-y-1">
                <div className="text-sm font-medium">{f.label}</div>
                <div className="space-y-2">
                  {types.map((t) => {
                    const v = byType.get(t);
                    return (
                      <div key={t} className="space-y-1">
                        {showSubLabels && (
                          <div className="text-xs text-muted-foreground">
                            {TYPE_CAPTIONS[t]}
                          </div>
                        )}
                        <FieldValueRenderer
                          field={f}
                          displayType={t}
                          value={v}
                          signedUrls={signedUrls}
                        />
                      </div>
                    );
                  })}
                  {legacyTypes.map((t) => {
                    const v = byType.get(t);
                    return (
                      <div key={`legacy-${t}`} className="space-y-1 opacity-70">
                        <div className="text-xs text-muted-foreground italic">
                          Legacy (was: {TYPE_CAPTIONS[t]})
                        </div>
                        <FieldValueRenderer
                          field={f}
                          displayType={t}
                          value={v}
                          signedUrls={signedUrls}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {(isAdmin || isAuthor) && (
        <NotionUrlCard
          requestId={id}
          currentNotionUrl={request.notion_url}
        />
      )}

      {isAdmin && (
        <AdminControls
          requestId={id}
          statuses={statuses}
          currentStatusId={request.status_id}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tagged for feedback</CardTitle>
          <CardDescription>
            People and teams asked to weigh in on this request. Tagged users
            can comment even if they&apos;re not on the author&apos;s team.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TagPicker
            requestId={id}
            profiles={profileRows ?? []}
            teams={teamRows ?? []}
            taggedUserIds={taggedUserIds}
            taggedTeamIds={taggedTeamIds}
            canMutate={canManageTags}
          />
        </CardContent>
      </Card>

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
  displayType,
  value,
  signedUrls,
}: {
  field: FieldDefinition;
  displayType: FieldType;
  value: FieldValue | undefined;
  signedUrls: Map<string, string>;
}) {
  if (!value) {
    return <p className="text-sm text-muted-foreground">—</p>;
  }
  switch (displayType) {
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
      if (displayType === "image") {
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
