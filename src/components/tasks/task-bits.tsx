"use client";

import { useOptimistic, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ListChecksIcon, LockIcon, RepeatIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/dates";
import { setTaskStatusAction } from "@/server/actions/tasks";
import type { TaskRow } from "@/server/tasks";
import { PRIORITY_LABEL, PRIORITY_TONE } from "./labels";

/** Tick box that completes/reopens a task with optimistic UI. */
export function DoneToggle({ task }: { task: TaskRow }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [done, setDone] = useOptimistic(task.status === "done");
  return (
    <Checkbox
      checked={done}
      aria-label={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
      onCheckedChange={(v) =>
        start(async () => {
          setDone(v === true);
          const r = await setTaskStatusAction(task.id, v === true ? "done" : "todo");
          if (!r.ok) toast.error(r.error);
          else if (v === true && task.recurrence_rule) toast.success("Done. The next occurrence has been scheduled.");
          router.refresh();
        })
      }
    />
  );
}

export function TaskLine({ task, today, showDate = true }: { task: TaskRow; today: string; showDate?: boolean }) {
  const overdue = task.due_date && task.due_date < today && task.status !== "done";
  return (
    <div className="flex min-w-0 items-start gap-3 py-2">
      <span className="mt-0.5">
        <DoneToggle task={task} />
      </span>
      <div className="min-w-0 flex-1">
        <Link href={`?task=${task.id}`} scroll={false} className={cn("block truncate text-sm hover:text-gold-ink", task.status === "done" && "text-muted-foreground line-through")}>
          {task.title}
        </Link>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
          {task.deal_name && <span className="truncate">{task.deal_name}</span>}
          {task.project_name && !task.deal_name && <span className="truncate">{task.project_name}</span>}
          {task.assignee_name && <span>· {task.assignee_name}</span>}
          {task.checklist_total > 0 && (
            <span className="num inline-flex items-center gap-0.5">
              <ListChecksIcon className="size-3" /> {task.checklist_done}/{task.checklist_total}
            </span>
          )}
          {task.recurrence_rule && <RepeatIcon className="size-3" aria-label="Repeats" />}
          {task.open_blockers > 0 && (
            <span className="inline-flex items-center gap-0.5 text-warning">
              <LockIcon className="size-3" /> waiting on {task.open_blockers}
            </span>
          )}
        </div>
      </div>
      {(task.priority === "high" || task.priority === "urgent") && <Badge variant={PRIORITY_TONE[task.priority]}>{PRIORITY_LABEL[task.priority]}</Badge>}
      {showDate && task.due_date && <span className={cn("num shrink-0 text-xs", overdue ? "text-danger" : "text-muted-foreground")}>{fmtDate(task.due_date, "d MMM")}</span>}
    </div>
  );
}
