"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createTeam } from "../actions";

const NONE = "__none__";

export function CreateTeamDialog({
  companies = [],
}: {
  companies?: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [companyId, setCompanyId] = useState<string>(NONE);

  function onSubmit(formData: FormData) {
    formData.set("company_id", companyId);
    startTransition(async () => {
      try {
        await createTeam(formData);
        toast.success("Team created");
        setOpen(false);
        setCompanyId(NONE);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to create team";
        toast.error(message);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>New team</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create team</DialogTitle>
          <DialogDescription>
            Add a new team. You can assign members afterwards.
          </DialogDescription>
        </DialogHeader>
        <form action={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required autoFocus />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" rows={3} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company">Company</Label>
            <Select value={companyId} onValueChange={setCompanyId}>
              <SelectTrigger id="company">
                <SelectValue placeholder="No company" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No company</SelectItem>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {companies.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No companies yet — add some in the Companies section.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
