import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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

// Global-admin route — the /admin layout already enforces requireAdmin(), so no
// extra guard is needed here. The template mutations are separately authorized
// in template-actions.ts.
export default async function AdminWorkstreamTemplatePage({
  params,
}: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: product } = await supabase
    .from("products")
    .select("id, name")
    .eq("id", id)
    .maybeSingle<{ id: string; name: string }>();
  if (!product) notFound();

  const [template, addableCatalog] = await Promise.all([
    getWorkstreamTemplate(supabase, id),
    getAddableCatalogFields(supabase, id),
  ]);

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href="/admin/products">← Workstreams</Link>
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
