import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RequestForm } from "@/components/request-form";
import type { FieldDefinition, FieldValue, RequestRow } from "@/lib/types";

export const dynamic = "force-dynamic";

interface EditPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditRequestPage({ params }: EditPageProps) {
  const { id } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: request } = await supabase
    .from("requests")
    .select("*")
    .eq("id", id)
    .maybeSingle<RequestRow>();

  if (!request) notFound();

  const isAdmin = profile.role === "admin";
  const isAuthor = request.author_id === profile.id;
  const isDraft = request.state === "draft";

  // Authors can edit their own requests in any state; admins can edit anything.
  // Anyone else lands on the read-only detail page.
  if (!isAuthor && !isAdmin) {
    redirect(`/requests/${id}`);
  }

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

  const { data: products } = await supabase
    .from("products")
    .select("id, name")
    .order("name")
    .returns<{ id: string; name: string }[]>();

  // Teams + this request's existing team tags. Authors flag dependent teams
  // while drafting; the picker below the deadline field reads from these.
  const { data: allTeams } = await supabase
    .from("teams")
    .select("id, name")
    .order("name", { ascending: true })
    .returns<{ id: string; name: string }[]>();

  const { data: teamTagRows } = await supabase
    .from("request_team_tags")
    .select("team_id")
    .eq("request_id", id)
    .returns<{ team_id: string }[]>();
  const taggedTeamIds = (teamTagRows ?? []).map((r) => r.team_id);

  // Sign URLs for any image values so the form can show a live preview of
  // what's already attached, not just the filename.
  const signedUrls: Record<string, string> = {};
  const imagePaths = (values ?? [])
    .filter((v) => v.field_type === "image" && v.file_path)
    .map((v) => v.file_path as string);
  if (imagePaths.length > 0) {
    const { data: signed } = await supabase.storage
      .from("request-attachments")
      .createSignedUrls(imagePaths, 3600);
    for (const s of signed ?? []) {
      if (s.path && s.signedUrl) signedUrls[s.path] = s.signedUrl;
    }
  }

  const canSubmit = isAuthor && isDraft;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {isDraft ? "Edit draft" : "Edit submitted request"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isDraft
              ? "Save as you go. Submit when you're ready for the product team to look."
              : isAuthor
                ? "Update your submitted request. Changes save in place; status doesn't change."
                : "Admin edit mode."}
          </p>
        </div>
        <Button asChild variant="ghost">
          <Link href={`/requests/${id}`}>View detail</Link>
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Request details</CardTitle>
          <CardDescription>
            Required fields are marked with a red asterisk. Soft-required
            fields have a small dot — you can skip them but the team may ask
            for more info.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RequestForm
            request={request}
            fields={fields ?? []}
            values={values ?? []}
            canSubmit={canSubmit}
            hasTeam={Boolean(profile.team_id)}
            uploaderId={profile.id}
            signedUrls={signedUrls}
            products={products ?? []}
            allTeams={allTeams ?? []}
            initialTaggedTeamIds={taggedTeamIds}
            authorTeamId={request.team_id}
          />
        </CardContent>
      </Card>
    </div>
  );
}
