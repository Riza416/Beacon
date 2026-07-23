"use client";

import * as React from "react";
import { Sun, Moon, SunMoon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  /** When true, render only the icon (sidebar collapsed rail). */
  collapsed?: boolean;
}

/**
 * Flips light/dark by toggling the `dark` class on <html> and persisting the
 * choice to localStorage (the root layout reads it before paint to avoid a
 * flash). Renders a neutral icon until mounted so SSR and the first client
 * render agree — reading the actual theme in an effect avoids a hydration
 * mismatch.
 */
export function ThemeToggle({ collapsed = false }: ThemeToggleProps) {
  const [mounted, setMounted] = React.useState(false);
  const [isDark, setIsDark] = React.useState(false);

  React.useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
    setMounted(true);
  }, []);

  function toggle() {
    const next = isDark ? "light" : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      localStorage.setItem("theme", next);
    } catch {
      // Ignore storage failures (private mode / disabled); the class still flips.
    }
    setIsDark(next === "dark");
  }

  // Before mount we don't know the theme; show a neutral icon and a generic
  // label so the markup matches what the server rendered.
  const label = !mounted ? "Toggle theme" : isDark ? "Light mode" : "Dark mode";
  const Icon = !mounted ? SunMoon : isDark ? Sun : Moon;

  return (
    <button
      type="button"
      onClick={toggle}
      title={label}
      aria-label={label}
      className={cn(
        "flex items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
        collapsed
          ? "h-9 w-9 justify-center"
          : "h-9 w-full gap-2 px-3 text-sm"
      )}
    >
      <Icon className="h-5 w-5 shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </button>
  );
}
