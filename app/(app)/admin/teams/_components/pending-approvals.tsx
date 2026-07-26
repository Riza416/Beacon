"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserCheck, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LocalTime } from "@/components/local-time";
import { approveMember, rejectMember } from "../actions";

export interface PendingProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
}

/** New sign-ups awaiting a global admin's decision. */
export function PendingApprovals({ pending }: { pending: PendingProfile[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (pending.length === 0) return null;

  function run(msg: string, fn: () => Promise<{ ok: true }>) {
    startTransition(async () => {
      try {
        await fn();
        toast.success(msg);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not update");
      }
    });
  }

  return (
    <section className="space-y-2">
      <h2 className="text-lg font-medium">
        Pending approval ({pending.length})
      </h2>
      <p className="text-xs text-muted-foreground">
        New sign-ups can&apos;t see anything until approved. Rejecting deletes
        the account.
      </p>
      <Card className="border-amber-500/40">
        <CardContent className="divide-y p-0">
          {pending.map((p) => (
            <div key={p.id} className="flex items-center gap-3 p-3 sm:px-4">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {p.full_name?.trim() || p.email || "Unknown"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {p.email} · signed up <LocalTime value={p.created_at} />
                </p>
              </div>
              <Button
                size="sm"
                disabled={isPending}
                onClick={() =>
                  run(`Approved ${p.email ?? "account"}`, () =>
                    approveMember(p.id)
                  )
                }
              >
                <UserCheck className="mr-1.5 h-4 w-4" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:text-destructive"
                disabled={isPending}
                onClick={() =>
                  run(`Rejected ${p.email ?? "account"}`, () =>
                    rejectMember(p.id)
                  )
                }
              >
                <UserX className="mr-1.5 h-4 w-4" />
                Reject
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}
