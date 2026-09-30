import Link from "next/link";
import { CalendarClockIcon, CheckSquareIcon, FlagIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/dates";
import type { WeekEntry } from "@/server/command-center";

const ICON = { meeting: CalendarClockIcon, task: CheckSquareIcon, deadline: FlagIcon };

export function WeekStrip({ days, entries, today }: { days: string[]; entries: WeekEntry[]; today: string }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ol className="grid min-w-[44rem] grid-cols-7 gap-2">
        {days.map((day) => {
          const items = entries.filter((e) => e.day === day);
          const isToday = day === today;
          const weekend = [5, 6].includes(days.indexOf(day));
          return (
            <li key={day} className={cn("min-h-28 rounded-md border p-2", isToday ? "border-gold/60 bg-gold-wash/30" : weekend && "bg-surface-2/40")}>
              <p className={cn("num flex items-baseline justify-between text-xs", isToday ? "text-gold-ink" : "text-muted-foreground")}>
                <span>{fmtDate(day, "EEE")}</span>
                <span>{fmtDate(day, "d MMM")}</span>
              </p>
              <ul className="mt-2 space-y-1.5">
                {items.map((e) => {
                  const Icon = ICON[e.kind];
                  const inner = (
                    <>
                      <Icon className={cn("mt-0.5 size-3 shrink-0", e.kind === "deadline" ? "text-danger" : "text-muted-foreground")} />
                      <span className="min-w-0">
                        {e.time && <span className="num text-muted-foreground">{e.time} </span>}
                        <span className="line-clamp-2">{e.title}</span>
                      </span>
                    </>
                  );
                  return (
                    <li key={`${e.kind}:${e.entity_id}`} className="text-[11px] leading-snug">
                      {e.entity_type === "meeting" ? (
                        <span className="flex gap-1.5">{inner}</span>
                      ) : (
                        <Link href={`?record=${e.entity_type}:${e.entity_id}`} scroll={false} className="flex gap-1.5 hover:text-gold-ink">
                          {inner}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
