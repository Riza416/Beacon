"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";
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
import { createProject, updateProject } from "../actions";

interface ProjectDialogProps {
  /** Omit to create; provide to edit an existing project. */
  project?: { id: string; name: string; description: string | null };
  /** Render a compact icon-style trigger instead of the default button. */
  variant?: "default" | "outline";
}

export function ProjectDialog({ project, variant }: ProjectDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [isPending, startTransition] = useTransition();
  const editing = Boolean(project);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Give the project a name");
      return;
    }
    startTransition(async () => {
      try {
        if (editing && project) {
          await updateProject(project.id, { name, description });
          toast.success("Project updated");
          setOpen(false);
          router.refresh();
        } else {
          const { id } = await createProject({ name, description });
          toast.success("Project created");
          setOpen(false);
          router.push(`/projects/${id}`);
        }
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Something went wrong"
        );
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        // Reset the form to the project's current values whenever we reopen.
        if (o) {
          setName(project?.name ?? "");
          setDescription(project?.description ?? "");
        }
      }}
    >
      <DialogTrigger asChild>
        {editing ? (
          <Button variant={variant ?? "outline"} size="sm">
            <Pencil className="mr-1.5 h-4 w-4" />
            Edit
          </Button>
        ) : (
          <Button variant={variant ?? "default"}>
            <Plus className="mr-1.5 h-4 w-4" />
            New project
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit project" : "New project"}</DialogTitle>
          <DialogDescription>
            Group requests to different teams under one project so you can track
            them together.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project-name">Name</Label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Q3 merchant onboarding revamp"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-description">Description</Label>
            <Textarea
              id="project-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="What is this project about? (optional)"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? editing
                  ? "Saving…"
                  : "Creating…"
                : editing
                  ? "Save"
                  : "Create project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
