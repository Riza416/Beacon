"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

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
  const hasAny =
    team !== ALL || status !== ALL || author !== ALL || product !== ALL;

  function update(key: string, value: string) {
    const params = new URLSearchParams(search.toString());
    if (value === ALL) params.delete(key);
    else params.set(key, value);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function clearAll() {
    router.push(pathname);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Filter
      </span>

      <Select value={product} onValueChange={(v) => update("product", v)}>
        <SelectTrigger className="h-8 w-[170px] text-xs">
          <SelectValue placeholder="Product" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL} className="text-xs">
            All products
          </SelectItem>
          {products.map((p) => (
            <SelectItem key={p.id} value={p.id} className="text-xs">
              {p.name}
            </SelectItem>
          ))}
          <SelectItem value={UNASSIGNED} className="text-xs">
            No product
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
