"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RichText } from "@/components/rich-text";
import {
  createFaq,
  deleteFaq,
  moveFaq,
  updateFaq,
} from "@/app/(app)/workstreams/actions";

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

interface FaqDraft {
  question: string;
  answer: string;
}

const EMPTY_DRAFT: FaqDraft = { question: "", answer: "" };

/**
 * The FAQ list for a workstream. Everyone sees the accordion; the owning team
 * and admins (`canManage`) also get add / edit / delete / reorder controls.
 */
export function FaqManager({
  productId,
  faqs,
  canManage,
}: {
  productId: string;
  faqs: FaqItem[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  /** `"new"` while adding, an faq id while editing that entry, else null. */
  const [editing, setEditing] = React.useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState<FaqItem | null>(null);

  function run(msg: string, fn: () => Promise<{ ok: true }>, after?: () => void) {
    startTransition(async () => {
      try {
        await fn();
        toast.success(msg);
        after?.();
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not update FAQs");
      }
    });
  }

  function onCreate(draft: FaqDraft) {
    run("FAQ added", () => createFaq(productId, draft), () => setEditing(null));
  }

  function onUpdate(faqId: string, draft: FaqDraft) {
    run("FAQ updated", () => updateFaq(faqId, draft), () => setEditing(null));
  }

  function onDelete(faq: FaqItem) {
    run("FAQ deleted", () => deleteFaq(faq.id), () => setConfirmDelete(null));
  }

  function onMove(faqId: string, direction: "up" | "down") {
    run("FAQ reordered", () => moveFaq(faqId, direction));
  }

  return (
    <div className="space-y-3">
      {faqs.length === 0 ? (
        // While the add form is open the empty state would only be noise.
        editing === "new" ? null : canManage ? (
          <div className="rounded-md border border-dashed p-8 text-center">
            <p className="text-sm font-medium">No FAQs yet</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Add guidance so other teams know what belongs here and how to ask
              for it.
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            This workstream hasn&apos;t published any FAQs yet.
          </p>
        )
      ) : (
        <ul className="space-y-2">
          {faqs.map((faq, idx) => (
            <li key={faq.id}>
              {canManage && editing === faq.id ? (
                <FaqEditor
                  heading="Edit FAQ"
                  initial={faq}
                  pending={pending}
                  onSave={(draft) => onUpdate(faq.id, draft)}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <div className="flex items-start gap-1 rounded-md border">
                  <details className="group min-w-0 flex-1" open={idx === 0}>
                    <summary className="flex cursor-pointer list-none items-center gap-2 p-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
                      <span className="min-w-0">{faq.question}</span>
                    </summary>
                    <div className="px-3 pb-3 pl-9">
                      {faq.answer.trim().length > 0 ? (
                        <RichText
                          text={faq.answer}
                          className="text-muted-foreground"
                        />
                      ) : (
                        <p className="text-sm italic text-muted-foreground">
                          No answer yet.
                        </p>
                      )}
                    </div>
                  </details>

                  {canManage && (
                    <div className="flex shrink-0 items-center gap-0.5 p-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        aria-label={`Move "${faq.question}" up`}
                        disabled={pending || idx === 0}
                        onClick={() => onMove(faq.id, "up")}
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        aria-label={`Move "${faq.question}" down`}
                        disabled={pending || idx === faqs.length - 1}
                        onClick={() => onMove(faq.id, "down")}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        aria-label={`Edit "${faq.question}"`}
                        disabled={pending}
                        onClick={() => setEditing(faq.id)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        aria-label={`Delete "${faq.question}"`}
                        disabled={pending}
                        onClick={() => setConfirmDelete(faq)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {canManage &&
        (editing === "new" ? (
          <FaqEditor
            heading="New FAQ"
            initial={EMPTY_DRAFT}
            pending={pending}
            onSave={onCreate}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending || editing !== null}
            onClick={() => setEditing("new")}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Add FAQ
          </Button>
        ))}

      <Dialog
        open={confirmDelete !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDelete(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete FAQ</DialogTitle>
            <DialogDescription>
              Delete &ldquo;{confirmDelete?.question}&rdquo;? This removes it
              from the workstream for everyone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmDelete(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={() => confirmDelete && onDelete(confirmDelete)}
            >
              {pending ? "Deleting…" : "Delete FAQ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * The add/edit form. Kept uncontrolled from the parent's point of view — mount
 * it with the values you want prefilled and it owns the draft from there.
 */
function FaqEditor({
  heading,
  initial,
  pending,
  onSave,
  onCancel,
}: {
  heading: string;
  initial: FaqDraft;
  pending: boolean;
  onSave: (draft: FaqDraft) => void;
  onCancel: () => void;
}) {
  const uid = React.useId();
  const [question, setQuestion] = React.useState(initial.question);
  const [answer, setAnswer] = React.useState(initial.answer);

  const trimmedQuestion = question.trim();
  const trimmedAnswer = answer.trim();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (trimmedQuestion.length === 0) {
      toast.error("A question is required");
      return;
    }
    onSave({ question: trimmedQuestion, answer: trimmedAnswer });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-3 rounded-md border bg-muted/30 p-4"
    >
      <p className="text-sm font-semibold">{heading}</p>

      <div className="space-y-2">
        <Label htmlFor={`${uid}-question`}>Question</Label>
        <Input
          id={`${uid}-question`}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="How do I ask for a schema change?"
          autoComplete="off"
          autoFocus
          disabled={pending}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${uid}-answer`}>Answer</Label>
        <Textarea
          id={`${uid}-answer`}
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          rows={6}
          placeholder="Open a request with the migration you have in mind…"
          disabled={pending}
        />
        <p className="text-xs text-muted-foreground">
          Formatting: <code className="font-mono">**bold**</code>,{" "}
          <code className="font-mono">`code`</code>,{" "}
          <code className="font-mono">- bullet</code>,{" "}
          <code className="font-mono">[link](https://…)</code>. Blank lines
          separate paragraphs.
        </p>
      </div>

      {trimmedAnswer.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Preview</p>
          <div className="rounded-md border bg-background p-3">
            <RichText text={answer} className="text-muted-foreground" />
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button
          type="submit"
          size="sm"
          disabled={pending || trimmedQuestion.length === 0}
        >
          {pending ? "Saving…" : "Save"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
