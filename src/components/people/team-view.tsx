"use client";

import { useState } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { MailIcon, PhoneIcon, PlusIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table/data-table";
import type { SavedView } from "@/components/data-table/types";
import { daysBetween, fmtDate, todayDubai } from "@/lib/dates";
import { EMPLOYEE_STATUSES } from "@/lib/people";
import { label } from "@/lib/schemas/common";
import type { DirectoryRow, EmployeeRow } from "@/server/people";
import { EmployeeFormDialog } from "./employee-form-dialog";
import { employeeStatusVariant } from "./format";

type Opt = { value: string; label: string };

export function TeamView({ rows, views, options }: { rows: EmployeeRow[]; views: SavedView[]; options: { employees: Opt[]; logins: Opt[] } }) {
  const [open, setOpen] = useState(false);
  const today = todayDubai();
  const columns: ColumnDef<EmployeeRow, unknown>[] = [
    {
      accessorKey: "full_name",
      header: "Name",
      enableHiding: false,
      meta: { label: "Name", className: "min-w-56" },
      cell: ({ row }) => (
        <div className="min-w-0">
          <Link href={`/people/${row.original.id}`} className="font-medium hover:text-gold-ink">
            {row.original.full_name}
          </Link>
          {row.original.is_demo && <Badge variant="outline" className="ml-2 align-middle">Demo</Badge>}
          <div className="mt-0.5 text-xs text-muted-foreground">{[row.original.job_title, row.original.department].filter(Boolean).join(" · ") || "—"}</div>
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      meta: { label: "Status", csv: (r) => label(r.status) },
      cell: ({ getValue }) => <Badge variant={employeeStatusVariant(String(getValue()))}>{label(String(getValue()))}</Badge>,
    },
    { accessorKey: "manager", header: "Reports to", meta: { label: "Reports to" }, cell: ({ getValue }) => (getValue() as string) ?? "—" },
    {
      accessorKey: "start_date",
      header: "Started",
      sortUndefined: "last",
      meta: { label: "Started" },
      cell: ({ getValue }) => <span className="num">{getValue() ? fmtDate(String(getValue())) : "—"}</span>,
    },
    {
      id: "expiry",
      accessorFn: (r) => r.next_expiry?.date ?? null,
      header: "Next expiry",
      sortUndefined: "last",
      meta: { label: "Next document expiry", csv: (r) => (r.next_expiry ? `${r.next_expiry.what} ${r.next_expiry.date}` : "") },
      cell: ({ row }) => {
        const x = row.original.next_expiry;
        if (!x) return <span className="text-muted-foreground">—</span>;
        const days = daysBetween(today, x.date);
        return (
          <div className="text-xs">
            <span className={`num font-medium ${days < 0 ? "text-danger" : days <= 30 ? "text-danger" : days <= 60 ? "text-warning" : ""}`}>
              {fmtDate(x.date)} · {days < 0 ? `${-days} d ago` : `${days} d`}
            </span>
            <div className="text-muted-foreground">{x.what}</div>
          </div>
        );
      },
    },
    { accessorKey: "login", header: "Login", meta: { label: "Login" }, cell: ({ getValue }) => (getValue() as string) ?? <span className="text-muted-foreground">None</span> },
  ];

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          <span className="num font-medium text-foreground">{rows.filter((r) => r.status !== "left").length}</span> people · alerts go out 90, 60, 30 and 7 days before a visa, Emirates ID, labour card, passport or insurance expires.
        </p>
        <Button size="sm" onClick={() => setOpen(true)}>
          <PlusIcon /> New employee
        </Button>
      </div>
      <DataTable
        module="employees"
        columns={columns}
        data={rows}
        views={views}
        csvName="lantana-team"
        rowHref={(e) => `/people/${e.id}`}
        searchPlaceholder="Search people…"
        defaultSorting={[{ id: "full_name", desc: false }]}
        defaultHidden={["login"]}
        facets={[{ columnId: "status", label: "Statuses", options: EMPLOYEE_STATUSES.map((s) => ({ value: s, label: label(s) })) }]}
        empty="Nobody on the team yet."
      />
      <EmployeeFormDialog open={open} onOpenChange={setOpen} options={options} />
    </>
  );
}

export function DirectoryGrid({ rows, myId }: { rows: DirectoryRow[]; myId: string | null }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map((p) => (
        <li key={p.id} className="min-w-0 rounded-lg border bg-surface p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-medium">
                {p.full_name}
                {p.is_self && <Badge variant="gold" className="ml-2 align-middle">You</Badge>}
              </p>
              <p className="truncate text-sm text-muted-foreground">{[p.job_title, p.department].filter(Boolean).join(" · ") || "—"}</p>
            </div>
            {p.status === "onboarding" && <Badge variant="info">Joining</Badge>}
          </div>
          <div className="mt-3 space-y-1 text-sm">
            {p.work_email && (
              <a href={`mailto:${p.work_email}`} className="flex min-w-0 items-center gap-2 hover:text-gold-ink">
                <MailIcon className="size-3.5 shrink-0 text-muted-foreground" /> <span className="truncate">{p.work_email}</span>
              </a>
            )}
            {p.phone && (
              <a href={`tel:${p.phone}`} className="flex items-center gap-2 hover:text-gold-ink">
                <PhoneIcon className="size-3.5 text-muted-foreground" /> {p.phone}
              </a>
            )}
            {p.manager_name && <p className="text-xs text-muted-foreground">Reports to {p.manager_name}</p>}
          </div>
          {p.is_self && myId && (
            <Link href={`/people/${myId}`} className="mt-3 inline-block text-xs font-medium text-gold-ink hover:underline">
              Your record and leave →
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}
