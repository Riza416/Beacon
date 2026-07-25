"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { getUnreadCount } from "@/app/(app)/unread-actions";

/**
 * Bell icon in the sidebar. The unread count is fetched client-side AFTER the
 * page renders (and re-fetched on route change), so navigation never waits on
 * the unread queries. Badge in violet so it stays legible on both themes;
 * capped at 99+ to keep the chip narrow.
 */
export function NotificationBell() {
  const pathname = usePathname();
  const [count, setCount] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    getUnreadCount()
      .then((n) => {
        if (!cancelled) setCount(n);
      })
      .catch(() => {
        // Best-effort — a failed count fetch never breaks the page.
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

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
