"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Inbox,
  SquarePen,
  FolderKanban,
  UsersRound,
  Layers,
  Users,
  ListChecks,
  CircleDot,
  BarChart3,
  BookOpen,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BeaconLogo, BeaconMark } from "@/components/logo";
import { NotificationBell } from "@/components/notification-bell";
import { DemoModeToggle } from "@/components/demo-mode-toggle";
import { ThemeToggle } from "@/components/theme-toggle";

interface AppSidebarProps {
  isAdmin: boolean;
  isTeamAdmin: boolean;
  canManageTeamProducts: boolean;
  email: string | null;
  role: string;
  unread: number;
  demoOn: boolean;
  initialCollapsed: boolean;
}

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export function AppSidebar({
  isAdmin,
  isTeamAdmin,
  canManageTeamProducts,
  email,
  role,
  unread,
  demoOn,
  initialCollapsed,
}: AppSidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(initialCollapsed);

  // Icons live here rather than being serialized across the server boundary.
  const items: NavItem[] = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/requests/mine", label: "My requests", icon: Inbox },
    { href: "/projects", label: "Projects", icon: FolderKanban },
    { href: "/requests/new", label: "New request", icon: SquarePen },
  ];
  if (isTeamAdmin) {
    items.push({ href: "/team", label: "My team", icon: UsersRound });
  }
  if (!isAdmin && !isTeamAdmin && canManageTeamProducts) {
    items.push({ href: "/team/products", label: "Workstreams", icon: Layers });
  }
  if (isAdmin) {
    items.push(
      { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/admin/teams", label: "Teams", icon: Users },
      { href: "/admin/products", label: "Workstreams", icon: Layers },
      { href: "/admin/requirements", label: "Fields", icon: ListChecks },
      { href: "/admin/statuses", label: "Statuses", icon: CircleDot }
    );
  }
  // Guide always last.
  items.push({ href: "/guide", label: "Guide", icon: BookOpen });

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `beacon_sidebar=${
      next ? "collapsed" : "expanded"
    }; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <aside
      className={cn(
        "sticky top-0 flex h-screen shrink-0 flex-col border-r bg-card transition-[width] duration-200 ease-in-out",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Header: logo + collapse toggle */}
      <div
        className={cn(
          "flex h-14 shrink-0 items-center border-b px-3",
          collapsed ? "justify-center" : "justify-between"
        )}
      >
        <Link
          href="/"
          aria-label="Beacon — home"
          className="flex min-w-0 items-center"
        >
          {collapsed ? (
            <BeaconMark size={22} />
          ) : (
            <BeaconLogo size={22} />
          )}
        </Link>
        {!collapsed && (
          <button
            type="button"
            onClick={toggleCollapsed}
            title="Collapse sidebar"
            aria-label="Collapse sidebar"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <PanelLeftClose className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* When collapsed, the expand button sits just under the logo. */}
      {collapsed && (
        <div className="flex justify-center px-3 pt-2">
          <button
            type="button"
            onClick={toggleCollapsed}
            title="Expand sidebar"
            aria-label="Expand sidebar"
            className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <PanelLeftOpen className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        {items.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center rounded-md text-sm font-medium transition-colors",
                collapsed ? "h-9 w-9 justify-center" : "h-9 gap-3 px-3",
                active
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer controls */}
      <div
        className={cn(
          "mt-auto flex flex-col gap-2 border-t p-2",
          collapsed && "items-center"
        )}
      >
        <ThemeToggle collapsed={collapsed} />

        <div
          className={cn(
            "flex items-center",
            collapsed ? "flex-col gap-2" : "gap-1"
          )}
        >
          <NotificationBell count={unread} />
          {isAdmin && !collapsed && <DemoModeToggle enabled={demoOn} />}
        </div>

        {!collapsed && (email || role) && (
          <div className="flex min-w-0 items-center justify-between gap-2 px-1">
            {email && (
              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                {email}
              </span>
            )}
            <Badge variant={isAdmin ? "default" : "secondary"}>{role}</Badge>
          </div>
        )}

        <form action="/auth/signout" method="post">
          <Button
            variant="ghost"
            size="sm"
            type="submit"
            title="Sign out"
            aria-label="Sign out"
            className={cn(
              "text-muted-foreground",
              collapsed ? "h-9 w-9 p-0" : "w-full justify-start gap-2"
            )}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Sign out</span>}
          </Button>
        </form>
      </div>
    </aside>
  );
}
