import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { FieldDefinition, RequiredLevel } from "@/lib/types";
import { CreateFieldDialog } from "./_components/create-field-dialog";
import { EditFieldDialog } from "./_components/edit-field-dialog";
import { FieldRowActions } from "./_components/field-row-actions";

const FIELD_TYPE_LABELS: Record<string, string> = {
  short_text: "Short text",
  long_text: "Long text",
  prd: "Product requirements document",
  url: "URL",
  file: "File",
  image: "Image",
  select: "Select",
  multi_select: "Multi-select",
  checkbox: "Checkbox",
};

function requiredLevelVariant(
  level: RequiredLevel
): "destructive" | "secondary" | "outline" {
  if (level === "hard") return "destructive";
  if (level === "soft") return "secondary";
  return "outline";
}

export default async function AdminRequirementsPage() {
  const supabase = await createClient();
  // Only the shared catalog (product_id null). Workstream-custom fields are
  // managed on each workstream's template page, not here.
  const { data: fields } = await supabase
    .from("request_field_definitions")
    .select("*")
    .is("product_id", null)
    .order("display_order", { ascending: true })
    .returns<FieldDefinition[]>();

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Request fields</h1>
          <p className="text-sm text-muted-foreground">
            Configure the fields shown on the request form, their order, and how
            strictly they&apos;re enforced.
          </p>
        </div>
        <CreateFieldDialog />
      </header>

      <Card>
        <CardContent className="p-0">
          {!fields || fields.length === 0 ? (
            <div className="flex flex-col items-center gap-3 p-8 text-center sm:p-12">
              <p className="text-base font-medium">No fields configured</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Add a field to start collecting structured information on
                request forms.
              </p>
              <div className="mt-2">
                <CreateFieldDialog />
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Required</TableHead>
                  <TableHead>Help text</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-56 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((field, idx) => (
                  <TableRow
                    key={field.id}
                    className={field.is_active ? "" : "opacity-50"}
                  >
                    <TableCell className="text-muted-foreground">
                      {idx + 1}
                    </TableCell>
                    <TableCell className="font-medium">{field.label}</TableCell>
                    <TableCell className="text-muted-foreground">
                      <div className="flex flex-wrap gap-1">
                        {(field.field_types && field.field_types.length > 0
                          ? field.field_types
                          : [field.field_type]
                        ).map((t) => (
                          <Badge key={t} variant="outline" className="text-xs">
                            {FIELD_TYPE_LABELS[t] ?? t}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={requiredLevelVariant(field.required_level)}>
                        {field.required_level}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground">
                      {field.help_text || "—"}
                    </TableCell>
                    <TableCell>
                      {field.is_active ? (
                        <Badge variant="secondary">Active</Badge>
                      ) : (
                        <Badge variant="outline">Archived</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <EditFieldDialog field={field} />
                        <FieldRowActions
                          fieldId={field.id}
                          isActive={field.is_active}
                          isFirst={idx === 0}
                          isLast={idx === fields.length - 1}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
