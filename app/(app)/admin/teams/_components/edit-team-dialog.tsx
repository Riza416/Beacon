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
import { updateTeam } from "../actions";

const NONE = "__none__";

interface EditTeamDialogProps {
  team: {
    id: string;
    name: string;
    description: string | null;
    company_id: string | null;
  };
  companies?: { id: string; name: string }[];
}

export function EditTeamDialog({ team, companies = [] }: EditTeamDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [companyId, setCompanyId] = useState<string>(team.company_id ?? NONE);

  function onSubmit(formData: FormData) {
    formData.set("company_id", companyId);
    startTransition(async () => {
      try {
        await updateTeam(formData);
        toast.success("Team updated");
        setOpen(false);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to update team";
        toast.error(message);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Edit</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit team</DialogTitle>
          <DialogDescription>Update the team name or description.</DialogDescription>
        </DialogHeader>
        <form action={onSubmit} className="space-y-4">
          <input type="hidden" name="id" value={team.id} />
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" defaultValue={team.name} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              rows={3}
              defaultValue={team.description ?? ""}
            />
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
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
