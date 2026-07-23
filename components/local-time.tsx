"use client";

import * as React from "react";

// Renders a timestamp in the VIEWER's timezone + locale. Dates formatted in a
// server component would otherwise use the server's timezone (UTC on Vercel).
//
// To stay hydration-safe, the first render (server HTML + first client paint)
// formats in UTC — deterministic, so server and client agree — then after
// mount it reformats in the device's local timezone.

type Mode = "datetime" | "date" | "dateFull";

const OPTIONS: Record<Mode, Intl.DateTimeFormatOptions> = {
  datetime: {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  },
  date: { month: "short", day: "numeric" },
  dateFull: { year: "numeric", month: "short", day: "numeric" },
};

function format(value: string, mode: Mode, timeZone?: string): string {
  const opts = OPTIONS[mode];
  return new Date(value).toLocaleString(
    undefined,
    timeZone ? { ...opts, timeZone } : opts
  );
}

export function LocalTime({
  value,
  mode = "datetime",
  fallback = "—",
}: {
  value: string | null | undefined;
  mode?: Mode;
  /** Shown when there's no value. */
  fallback?: string;
}) {
  const [text, setText] = React.useState<string>(() =>
    value ? format(value, mode, "UTC") : ""
  );

  React.useEffect(() => {
    if (value) setText(format(value, mode)); // device timezone
  }, [value, mode]);

  if (!value) return <>{fallback}</>;
  return (
    <time dateTime={value} suppressHydrationWarning>
      {text}
    </time>
  );
}
