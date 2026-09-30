"use client";

import Link from "next/link";
import { addMonths, format, parseISO, startOfMonth } from "date-fns";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { daysBetween, fmtDate, isoDate, shiftDate } from "@/lib/dates";
import type { TaskRow } from "@/server/tasks";

type Project = {
  id: string;
  name: string;
  start_date: string | null;
  target_date: string | null;
  milestones: { id: string; name: string; due_date: string | null; status: string }[];
};

/**
 * Six-month timeline: project spans as bars, milestones as diamonds, tasks as
 * dots on their due date. Tasks only have due dates, so there are no task
 * bars; that's deliberate rather than inventing start dates.
 */
export function Timeline({ projects, tasks, today }: { projects: Project[]; tasks: TaskRow[]; today: string }) {
  const start = isoDate(startOfMonth(parseISO(shiftDate(today, -30))));
  const end = isoDate(addMonths(parseISO(start), 6));
  const span = daysBetween(start, end);
  const pct = (d: string) => Math.min(100, Math.max(0, (daysBetween(start, d) / span) * 100));
  const inRange = (d: string | null) => Boolean(d && d >= start && d <= end);
  const months = Array.from({ length: 6 }, (_, i) => addMonths(parseISO(start), i));
  const open = tasks.filter((t) => t.status !== "cancelled");
  const rows = [
    ...projects.map((p) => ({ key: p.id, label: p.name, href: `/tasks/projects/${p.id}`, project: p, tasks: open.filter((t) => t.project_id === p.id) })),
    { key: "none", label: "Not in a project", href: undefined, project: null, tasks: open.filter((t) => !t.project_id) },
  ];

  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="min-w-[48rem] rounded-lg border bg-surface">
        <div className="grid grid-cols-[12rem_1fr] border-b text-xs text-muted-foreground">
          <div className="px-3 py-2">Project</div>
          <div className="relative h-8">
            {months.map((m) => (
              <span key={m.toISOString()} className="absolute top-2 border-l pl-1.5" style={{ left: `${pct(isoDate(m))}%` }}>
                {format(m, "MMM")}
              </span>
            ))}
          </div>
        </div>
        {rows.map((r) => (
          <div key={r.key} className="grid grid-cols-[12rem_1fr] border-b last:border-0">
            <div className="truncate px-3 py-3 text-sm">
              {r.href ? (
                <Link href={r.href} className="hover:text-gold-ink">
                  {r.label}
                </Link>
              ) : (
                <span className="text-muted-foreground">{r.label}</span>
              )}
            </div>
            <div className="relative h-12">
              {months.map((m) => (
                <span key={m.toISOString()} className="absolute inset-y-0 border-l border-border/60" style={{ left: `${pct(isoDate(m))}%` }} />
              ))}
              <span className="absolute inset-y-0 w-px bg-gold" style={{ left: `${pct(today)}%` }} aria-hidden />
              {r.project?.start_date && r.project.target_date && (
                <span
                  className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-gold-soft/40"
                  style={{ left: `${pct(r.project.start_date)}%`, width: `${Math.max(1, pct(r.project.target_date) - pct(r.project.start_date))}%` }}
                  aria-hidden
                />
              )}
              {r.project?.milestones.filter((m) => inRange(m.due_date)).map((m) => (
                <Tooltip key={m.id}>
                  <TooltipTrigger asChild>
                    <span
                      tabIndex={0}
                      className={cn("absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rotate-45 border-2", m.status === "done" ? "border-success bg-success" : m.due_date! < today ? "border-danger bg-surface" : "border-gold bg-surface")}
                      style={{ left: `${pct(m.due_date!)}%` }}
                    />
                  </TooltipTrigger>
                  <TooltipContent className="num">
                    Milestone · {m.name} · {fmtDate(m.due_date)}
                  </TooltipContent>
                </Tooltip>
              ))}
              {r.tasks.filter((t) => inRange(t.due_date)).map((t) => (
                <Tooltip key={t.id}>
                  <TooltipTrigger asChild>
                    <Link
                      href={`?task=${t.id}`}
                      scroll={false}
                      className={cn("absolute top-[75%] size-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface", t.status === "done" ? "bg-success" : t.due_date! < today ? "bg-danger" : "bg-muted-foreground")}
                      style={{ left: `${pct(t.due_date!)}%` }}
                      aria-label={`${t.title}, due ${fmtDate(t.due_date)}`}
                    />
                  </TooltipTrigger>
                  <TooltipContent className="num">
                    {t.title} · {fmtDate(t.due_date)}
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Bars: project span · diamonds: milestones · dots: task due dates · gold line: today.</p>
    </div>
  );
}
