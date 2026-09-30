"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data-table/data-table";
import type { SavedView } from "@/components/data-table/types";
import { fmtDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { PRIORITIES, RECURRENCES, TASK_STATUSES } from "@/lib/schemas/tasks";
import type { TaskRow } from "@/server/tasks";
import { PRIORITY_LABEL, PRIORITY_TONE, STATUS_LABEL, STATUS_TONE } from "./labels";
import { DoneToggle } from "./task-bits";

const PRIORITY_RANK = { urgent: 0, high: 1, medium: 2, low: 3 } as const;

export function TaskTable({ tasks, views, today, people, projects }: { tasks: TaskRow[]; views: SavedView[]; today: string; people: string[]; projects: string[] }) {
  const columns: ColumnDef<TaskRow, unknown>[] = [
    { id: "done", header: "", enableSorting: false, enableHiding: false, meta: { className: "w-8" }, cell: ({ row }) => <DoneToggle task={row.original} /> },
    {
      accessorKey: "title",
      header: "Task",
      enableHiding: false,
      meta: { label: "Task", className: "min-w-64" },
      cell: ({ row }) => (
        <Link href={`?task=${row.original.id}`} scroll={false} className={cn("hover:text-gold-ink", row.original.status === "done" && "text-muted-foreground line-through")}>
          {row.original.title}
        </Link>
      ),
    },
    { accessorKey: "status", header: "Status", meta: { label: "Status", csv: (r) => STATUS_LABEL[r.status] }, cell: ({ row }) => <Badge variant={STATUS_TONE[row.original.status]}>{STATUS_LABEL[row.original.status]}</Badge> },
    {
      accessorKey: "priority",
      header: "Priority",
      meta: { label: "Priority", csv: (r) => PRIORITY_LABEL[r.priority] },
      sortingFn: (a, b) => PRIORITY_RANK[a.original.priority] - PRIORITY_RANK[b.original.priority],
      cell: ({ row }) => <Badge variant={PRIORITY_TONE[row.original.priority]}>{PRIORITY_LABEL[row.original.priority]}</Badge>,
    },
    {
      accessorKey: "due_date",
      header: "Due",
      sortUndefined: "last",
      meta: { label: "Due" },
      cell: ({ row }) => {
        const d = row.original.due_date;
        return <span className={cn("num whitespace-nowrap", d && d < today && row.original.status !== "done" ? "text-danger" : "text-muted-foreground")}>{fmtDate(d) || "—"}</span>;
      },
    },
    { accessorKey: "assignee_name", header: "Assignee", meta: { label: "Assignee" }, cell: ({ getValue }) => (getValue() as string) ?? "—" },
    { accessorKey: "project_name", header: "Project", meta: { label: "Project" }, cell: ({ getValue }) => (getValue() as string) ?? "—" },
    {
      accessorKey: "deal_name",
      header: "Deal",
      meta: { label: "Deal" },
      cell: ({ row }) => (row.original.deal_id ? <Link className="hover:text-gold-ink" href={`/deals/${row.original.deal_id}`}>{row.original.deal_name}</Link> : "—"),
    },
    {
      id: "checklist",
      accessorFn: (r) => (r.checklist_total ? r.checklist_done / r.checklist_total : null),
      header: "Checklist",
      meta: { label: "Checklist", csv: (r) => (r.checklist_total ? `${r.checklist_done}/${r.checklist_total}` : "") },
      cell: ({ row }) => (row.original.checklist_total ? <span className="num">{row.original.checklist_done}/{row.original.checklist_total}</span> : "—"),
    },
    {
      accessorKey: "recurrence_rule",
      header: "Repeats",
      meta: { label: "Repeats", csv: (r) => RECURRENCES.find((x) => x.value === (r.recurrence_rule ?? ""))?.label ?? "" },
      cell: ({ getValue }) => RECURRENCES.find((x) => x.value === ((getValue() as string) ?? ""))?.label.replace("Doesn't repeat", "—") ?? "—",
    },
  ];

  return (
    <DataTable
      module="tasks"
      columns={columns}
      data={tasks}
      views={views}
      csvName="lantana-tasks"
      searchPlaceholder="Search tasks…"
      defaultSorting={[{ id: "due_date", desc: false }]}
      defaultHidden={["checklist", "recurrence_rule"]}
      facets={[
        { columnId: "status", label: "Statuses", options: TASK_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] })) },
        { columnId: "priority", label: "Priorities", options: PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABEL[p] })) },
        { columnId: "assignee_name", label: "Assignees", options: people.map((p) => ({ value: p, label: p })) },
        { columnId: "project_name", label: "Projects", options: projects.map((p) => ({ value: p, label: p })) },
      ]}
      empty="No tasks yet. Create one with New task."
    />
  );
}
