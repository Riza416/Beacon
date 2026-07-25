"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { X, Search } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface DashboardFiltersProps {
  teams: { id: string; name: string }[];
  statuses: { id: string; label: string; color: string }[];
  authors: { id: string; label: string }[];
  products: { id: string; name: string }[];
}

const ALL = "__all__";
const UNASSIGNED = "__unassigned__";

export function DashboardFilters({
  teams,
  statuses,
  authors,
  products,
}: DashboardFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  const team = search.get("team") ?? ALL;
  const status = search.get("status") ?? ALL;
  const author = search.get("author") ?? ALL;
  const product = search.get("product") ?? ALL;
  const q = search.get("q") ?? "";
  const hasAny =
    team !== ALL ||
    status !== ALL ||
    author !== ALL ||
    product !== ALL ||
    q.length > 0;

  // Debounced text search: typing updates local state instantly and pushes the
  // ?q= param 350ms after the last keystroke (replace, so each keystroke
  // doesn't pollute history).
  const [qInput, setQInput] = React.useState(q);
  React.useEffect(() => setQInput(q), [q]);
  React.useEffect(() => {
    if (qInput === q) return;
    const t = setTimeout(() => {
      const params = new URLSearchParams(search.toString());
      if (qInput.trim().length === 0) params.delete("q");
      else params.set("q", qInput.trim());
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qInput]);

  function update(key: string, value: string) {
    const params = new URLSearchParams(search.toString());
    if (value === ALL) params.delete(key);
    else params.set(key, value);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function clearAll() {
    setQInput("");
    router.push(pathname);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          placeholder="Search requests…"
          className="h-8 w-[200px] pl-8 text-xs"
          autoComplete="off"
          spellCheck={false}
          aria-label="Search requests by title or summary"
        />
      </div>

      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Filter
      </span>

      <Select value={product} onValueChange={(v) => update("product", v)}>
        <SelectTrigger className="h-8 w-[170px] text-xs">
          <SelectValue placeholder="Workstream" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL} className="text-xs">
            All workstreams
          </SelectItem>
          {products.map((p) => (
            <SelectItem key={p.id} value={p.id} className="text-xs">
              {p.name}
            </SelectItem>
          ))}
          <SelectItem value={UNASSIGNED} className="text-xs">
            No workstream
          </SelectItem>
        </SelectContent>
      </Select>

      <Select value={team} onValueChange={(v) => update("team", v)}>
        <SelectTrigger className="h-8 w-[160px] text-xs">
          <SelectValue placeholder="Team" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL} className="text-xs">
            All teams
          </SelectItem>
          {teams.map((t) => (
            <SelectItem key={t.id} value={t.id} className="text-xs">
              {t.name}
            </SelectItem>
          ))}
          <SelectItem value={UNASSIGNED} className="text-xs">
            Unassigned
          </SelectItem>
        </SelectContent>
      </Select>

      <Select value={status} onValueChange={(v) => update("status", v)}>
        <SelectTrigger className="h-8 w-[160px] text-xs">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL} className="text-xs">
            All statuses
          </SelectItem>
          {statuses.map((s) => (
            <SelectItem key={s.id} value={s.id} className="text-xs">
              <span className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: s.color }}
                />
                {s.label}
              </span>
            </SelectItem>
          ))}
          <SelectItem value={UNASSIGNED} className="text-xs">
            Unassigned
          </SelectItem>
        </SelectContent>
      </Select>

      <Select value={author} onValueChange={(v) => update("author", v)}>
        <SelectTrigger className="h-8 w-[200px] text-xs">
          <SelectValue placeholder="Author" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL} className="text-xs">
            All authors
          </SelectItem>
          {authors.map((a) => (
            <SelectItem key={a.id} value={a.id} className="text-xs">
              {a.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasAny && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearAll}
          className="h-8 gap-1 text-xs text-muted-foreground"
        >
          <X className="h-3 w-3" />
          Clear
        </Button>
      )}
    </div>
  );
}
