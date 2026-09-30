"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { addMonths, endOfMonth, format, parseISO, startOfMonth } from "date-fns";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fmtDate, isoDate, weekDays } from "@/lib/dates";
import type { TaskRow } from "@/server/tasks";

/** Month grid (Monday start) on desktop, agenda list on phones. */
export function TaskCalendar({ tasks, today, month }: { tasks: TaskRow[]; today: string; month: string }) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const first = startOfMonth(parseISO(`${month}-01`));
  const last = endOfMonth(first);
  const weeks: string[][] = [];
  let cursor = weekDays(isoDate(first))[0];
  while (cursor <= isoDate(last)) {
    const w = weekDays(cursor);
    weeks.push(w);
    cursor = isoDate(new Date(parseISO(w[6]).getTime() + 86400000));
  }
  const byDay = new Map<string, TaskRow[]>();
  for (const t of tasks) if (t.due_date && t.status !== "cancelled") byDay.set(t.due_date, [...(byDay.get(t.due_date) ?? []), t]);
  const href = (m: Date) => {
    const p = new URLSearchParams(sp.toString());
    p.set("view", "calendar");
    p.set("month", format(m, "yyyy-MM"));
    return `${pathname}?${p}`;
  };
  const monthDays = [...byDay.entries()].filter(([d]) => d.startsWith(month)).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button asChild variant="outline" size="icon-sm" aria-label="Previous month">
          <Link href={href(addMonths(first, -1))} scroll={false}>
            <ChevronLeftIcon />
          </Link>
        </Button>
        <h2 className="min-w-36 text-center font-display text-lg">{format(first, "MMMM yyyy")}</h2>
        <Button asChild variant="outline" size="icon-sm" aria-label="Next month">
          <Link href={href(addMonths(first, 1))} scroll={false}>
            <ChevronRightIcon />
          </Link>
        </Button>
      </div>

      <div className="hidden overflow-hidden rounded-lg border md:block">
        <div className="grid grid-cols-7 border-b bg-surface-2/60 text-xs text-muted-foreground">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="px-2 py-1.5">
              {d}
            </div>
          ))}
        </div>
        {weeks.map((w) => (
          <div key={w[0]} className="grid grid-cols-7 border-b last:border-0">
            {w.map((d, i) => {
              const inMonth = d.startsWith(month);
              const items = byDay.get(d) ?? [];
              return (
                <div key={d} className={cn("min-h-28 border-r p-1.5 last:border-0", !inMonth && "bg-surface-2/30", i >= 5 && inMonth && "bg-surface-2/20")}>
                  <p className={cn("num mb-1 text-right text-xs", d === today ? "font-semibold text-gold-ink" : "text-muted-foreground", !inMonth && "opacity-50")}>{Number(d.slice(8))}</p>
                  <ul className="space-y-1">
                    {items.slice(0, 4).map((t) => (
                      <li key={t.id}>
                        <Link
                          href={`?task=${t.id}`}
                          scroll={false}
                          className={cn(
                            "block truncate rounded-sm border-l-2 bg-surface px-1.5 py-0.5 text-[11px] hover:bg-surface-2",
                            t.status === "done" ? "border-success text-muted-foreground line-through" : d < today ? "border-danger" : "border-gold-soft",
                          )}
                        >
                          {t.title}
                        </Link>
                      </li>
                    ))}
                    {items.length > 4 && <li className="text-[11px] text-muted-foreground">+{items.length - 4} more</li>}
                  </ul>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <ol className="space-y-3 md:hidden">
        {monthDays.length === 0 && <li className="text-sm text-muted-foreground">Nothing due this month.</li>}
        {monthDays.map(([d, items]) => (
          <li key={d} className="rounded-lg border bg-surface px-3 py-2">
            <p className={cn("num text-xs", d === today ? "text-gold-ink" : "text-muted-foreground")}>{fmtDate(d, "EEE d MMM")}</p>
            <ul className="mt-1 space-y-1 text-sm">
              {items.map((t) => (
                <li key={t.id}>
                  <Link href={`?task=${t.id}`} scroll={false} className={cn("hover:text-gold-ink", t.status === "done" && "text-muted-foreground line-through")}>
                    {t.title}
                  </Link>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}
