"use client";

import { useOptimistic, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { GripVerticalIcon, LockIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { fmtDate, shiftDate } from "@/lib/dates";
import { setTaskStatusAction } from "@/server/actions/tasks";
import type { TaskRow } from "@/server/tasks";
import { PRIORITY_LABEL, PRIORITY_TONE, STATUS_LABEL } from "./labels";

const COLUMNS: TaskRow["status"][] = ["todo", "in_progress", "blocked", "done"];

export function TaskBoard({ tasks, today }: { tasks: TaskRow[]; today: string }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [items, move] = useOptimistic(tasks, (s, m: { id: string; status: TaskRow["status"] }) => s.map((t) => (t.id === m.id ? { ...t, status: m.status } : t)));
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );
  const recentCutoff = shiftDate(today, -14);

  function onDragEnd(e: DragEndEvent) {
    const t = items.find((x) => x.id === e.active.id);
    const status = e.over?.id as TaskRow["status"] | undefined;
    if (!t || !status || t.status === status) return;
    start(async () => {
      move({ id: t.id, status });
      const r = await setTaskStatusAction(t.id, status);
      if (!r.ok) toast.error(r.error);
      router.refresh();
    });
  }

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        <div className="grid min-w-[56rem] grid-cols-4 gap-3">
          {COLUMNS.map((status) => {
            const col = items.filter((t) => t.status === status && (status !== "done" || (t.completed_at ?? "") >= recentCutoff));
            return (
              <Column key={status} status={status} count={col.length}>
                {col.map((t) => (
                  <Card key={t.id} task={t} today={today} />
                ))}
              </Column>
            );
          })}
        </div>
      </div>
    </DndContext>
  );
}

function Column({ status, count, children }: { status: TaskRow["status"]; count: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section ref={setNodeRef} aria-label={`${STATUS_LABEL[status]}, ${count} tasks`} className={cn("flex min-h-40 flex-col rounded-lg border bg-surface-2/40", isOver && "border-gold/60 bg-gold-wash/40")}>
      <header className="flex items-baseline justify-between px-3 pt-3 pb-2 text-xs">
        <h3 className="font-medium">{STATUS_LABEL[status]}</h3>
        <span className="num text-muted-foreground">
          {count}
          {status === "done" && " · last 14 days"}
        </span>
      </header>
      <div className="flex flex-1 flex-col gap-2 px-2 pb-2">{children}</div>
    </section>
  );
}

function Card({ task, today }: { task: TaskRow; today: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  const overdue = task.due_date && task.due_date < today && task.status !== "done";
  return (
    <article
      ref={setNodeRef}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}
      className={cn("rounded-md border bg-surface p-2.5 text-sm", isDragging && "z-20 shadow-lg ring-1 ring-gold/50")}
    >
      <div className="flex items-start gap-1.5">
        <button {...listeners} {...attributes} aria-label={`Drag ${task.title}`} className="-ml-1 mt-0.5 cursor-grab touch-none rounded p-0.5 text-muted-foreground/60 hover:text-foreground">
          <GripVerticalIcon className="size-3.5" />
        </button>
        <Link href={`?task=${task.id}`} scroll={false} className="min-w-0 flex-1 leading-snug hover:text-gold-ink">
          {task.title}
        </Link>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
        {(task.priority === "high" || task.priority === "urgent") && <Badge variant={PRIORITY_TONE[task.priority]}>{PRIORITY_LABEL[task.priority]}</Badge>}
        {task.due_date && <span className={cn("num", overdue && "text-danger")}>{fmtDate(task.due_date, "d MMM")}</span>}
        {task.assignee_name && <span className="truncate">· {task.assignee_name}</span>}
        {task.open_blockers > 0 && (
          <span className="inline-flex items-center gap-0.5 text-warning">
            <LockIcon className="size-3" /> waiting
          </span>
        )}
      </div>
    </article>
  );
}
