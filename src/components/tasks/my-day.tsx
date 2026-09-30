"use client";

import { CircleCheckBigIcon } from "lucide-react";
import { shiftDate } from "@/lib/dates";
import type { TaskRow } from "@/server/tasks";
import { TaskLine } from "./task-bits";

export function MyDay({ tasks, userId, today }: { tasks: TaskRow[]; userId: string; today: string }) {
  const mine = tasks.filter((t) => t.assignee_id === userId && !["done", "cancelled"].includes(t.status));
  const week = shiftDate(today, 7);
  const groups = [
    { key: "overdue", title: "Overdue", items: mine.filter((t) => t.due_date && t.due_date < today) },
    { key: "today", title: "Today", items: mine.filter((t) => t.due_date === today) },
    { key: "week", title: "Next 7 days", items: mine.filter((t) => t.due_date && t.due_date > today && t.due_date <= week) },
    { key: "later", title: "Later", items: mine.filter((t) => t.due_date && t.due_date > week) },
    { key: "undated", title: "No date", items: mine.filter((t) => !t.due_date) },
  ];
  const doneToday = tasks.filter((t) => t.assignee_id === userId && t.status === "done" && t.completed_at?.slice(0, 10) === today);

  if (mine.length === 0)
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-14 text-center text-sm text-muted-foreground">
        <CircleCheckBigIcon className="size-6 text-success" />
        Nothing assigned to you is open. {doneToday.length > 0 && `You closed ${doneToday.length} today.`}
      </div>
    );

  return (
    <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
      {groups
        .filter((g) => g.items.length)
        .map((g) => (
          <section key={g.key} className="rounded-lg border bg-surface px-4 py-3" aria-labelledby={`myday-${g.key}`}>
            <h2 id={`myday-${g.key}`} className="num flex items-baseline justify-between text-sm font-medium">
              <span className={g.key === "overdue" ? "text-danger" : undefined}>{g.title}</span>
              <span className="text-xs text-muted-foreground">{g.items.length}</span>
            </h2>
            <div className="mt-1 divide-y">
              {g.items.map((t) => (
                <TaskLine key={t.id} task={t} today={today} showDate={g.key !== "today"} />
              ))}
            </div>
          </section>
        ))}
    </div>
  );
}
