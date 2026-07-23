"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createCompany, deleteCompany } from "../actions";

export function CompaniesManager({
  companies,
}: {
  companies: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  function add() {
    if (!name.trim()) {
      toast.error("Enter a company name");
      return;
    }
    const fd = new FormData();
    fd.set("name", name.trim());
    startTransition(async () => {
      try {
        await createCompany(fd);
        setName("");
        toast.success("Company added");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't add company");
      }
    });
  }

  function remove(id: string, label: string) {
    if (
      !window.confirm(
        `Delete "${label}"? Teams assigned to it will just lose the company link.`
      )
    )
      return;
    const fd = new FormData();
    fd.set("id", id);
    startTransition(async () => {
      try {
        await deleteCompany(fd);
        toast.success("Company deleted");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't delete");
      }
    });
  }

  return (
    <Card className="rounded-2xl border-border/60 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base tracking-tight">Companies</CardTitle>
        <CardDescription>
          The list of companies a team can be assigned to when it&apos;s created
          or edited.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Add a company…"
            disabled={pending}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
          />
          <Button onClick={add} disabled={pending || !name.trim()}>
            Add
          </Button>
        </div>
        {companies.length === 0 ? (
          <p className="text-sm text-muted-foreground">No companies yet.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {companies.map((c) => (
              <li
                key={c.id}
                className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 py-1 pl-3 pr-1.5 text-sm"
              >
                <span>{c.name}</span>
                <button
                  type="button"
                  onClick={() => remove(c.id, c.name)}
                  disabled={pending}
                  className="flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground disabled:opacity-50"
                  aria-label={`Delete ${c.name}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
