"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarRangeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RANGE_PRESETS, fmtDate, resolveRange } from "@/lib/dates";
import { cn } from "@/lib/utils";

/** Range lives in the URL (?range= or ?from=&to=) so every view is linkable. */
export function DateRangePicker() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const range = resolveRange({ from: sp.get("from") ?? undefined, to: sp.get("to") ?? undefined, range: sp.get("range") ?? undefined });
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);

  function apply(next: Record<string, string | null>) {
    const params = new URLSearchParams(sp.toString());
    for (const k of ["from", "to", "range"]) params.delete(k);
    for (const [k, v] of Object.entries(next)) if (v) params.set(k, v);
    router.push(`${pathname}${params.size ? `?${params}` : ""}`, { scroll: false });
    setOpen(false);
  }

  const label =
    range.key === "custom"
      ? `${fmtDate(range.from, "d MMM")} – ${fmtDate(range.to, "d MMM yy")}`
      : range.key === "ytd"
        ? "Year to date"
        : RANGE_PRESETS.find((p) => p.key === range.key)?.label;

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setFrom(range.from);
          setTo(range.to);
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" aria-label={`Date range: ${label}`}>
          <CalendarRangeIcon />
          <span className="hidden md:inline">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64">
        <div className="grid gap-1">
          {RANGE_PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => apply({ range: p.key === "90d" ? null : p.key })}
              className={cn(
                "cursor-pointer rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface-2",
                range.key === p.key && "bg-surface-2 text-gold-ink",
              )}
            >
              {p.label}
            </button>
          ))}
          <button
            onClick={() => apply({ range: "ytd" })}
            className={cn("cursor-pointer rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface-2", range.key === "ytd" && "bg-surface-2 text-gold-ink")}
          >
            Year to date
          </button>
        </div>
        <form
          className="mt-3 grid grid-cols-2 gap-2 border-t pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (from && to && from <= to) apply({ from, to });
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="range-from">From</Label>
            <Input id="range-from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="num h-8 px-2 text-xs" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="range-to">To</Label>
            <Input id="range-to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="num h-8 px-2 text-xs" />
          </div>
          <Button type="submit" size="sm" variant="secondary" className="col-span-2" disabled={!from || !to || from > to}>
            Apply custom range
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
