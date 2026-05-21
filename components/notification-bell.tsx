"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";

interface NotificationBellProps {
  count: number;
}

/**
 * Bell icon in the top nav. The count badge is rendered in violet so it stays
 * legible on both dark and light backgrounds; capped at 99+ to keep the chip
 * narrow.
 */
export function NotificationBell({ count }: NotificationBellProps) {
  const safe = Math.max(0, count);
  const label =
    safe === 0
      ? "Notifications"
      : safe === 1
        ? "1 unread tag"
        : `${safe} unread tags`;

  return (
    <Link
      href="/requests/tagged-for-me"
      aria-label={label}
      title={label}
      className={cn(
        "relative inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors",
        "hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      )}
    >
      <Bell className="h-5 w-5" />
      {safe > 0 && (
        <span
          className={cn(
            "absolute -right-0.5 -top-0.5 inline-flex min-w-[1.1rem] items-center justify-center rounded-full px-1 text-[10px] font-semibold leading-none text-white",
            "h-[1.1rem] bg-violet-600 ring-2 ring-background"
          )}
        >
          {safe > 99 ? "99+" : safe}
        </span>
      )}
    </Link>
  );
}
