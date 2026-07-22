import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canEditProducts } from "@/lib/actions/utils";
import {
  getAddableCatalogFields,
  getWorkstreamTemplate,
} from "@/lib/workstream-template";
import { WorkstreamTemplateEditor } from "@/components/workstream-template-editor";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

// Owning-team route. Anyone can reach /team/products, so this page must guard
// itself: only a global admin, or a member with the edit-products capability
// whose team OWNS this workstream, may edit its template. (The mutations in
// template-actions.ts enforce the same rule server-side; this just avoids
// rendering the editor to someone who can't use it.)
export default async function TeamWorkstreamTemplatePage({ params }: PageProps) {
  const { id } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: product } = await supabase
    .from("products")
    .select("id, name")
    .eq("id", id)
    .maybeSingle<{ id: string; name: string }>();
  if (!product) notFound();

  let allowed = profile.role === "admin";
  if (!allowed && canEditProducts(profile) && profile.team_id) {
    const { data: owns } = await supabase
      .from("product_owners")
      .select("team_id")
      .eq("product_id", id)
      .eq("team_id", profile.team_id)
      .maybeSingle();
    allowed = Boolean(owns);
  }
  if (!allowed) redirect("/team/products");

  const [template, addableCatalog] = await Promise.all([
    getWorkstreamTemplate(supabase, id),
    getAddableCatalogFields(supabase, id),
  ]);

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href="/team/products">← Workstreams</Link>
      </Button>
      <WorkstreamTemplateEditor
        productId={product.id}
        productName={product.name}
        template={template}
        addableCatalog={addableCatalog}
      />
    </div>
  );
}
