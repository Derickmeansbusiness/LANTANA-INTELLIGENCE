"use client";

import { useState } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { AlertTriangleIcon, PlusIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table/data-table";
import type { SavedView } from "@/components/data-table/types";
import { PageHeader } from "@/components/page-header";
import { fmtDate } from "@/lib/dates";
import { CONTRACT_STATUSES, CONTRACT_TYPES, CONTRACT_TYPE_LABEL } from "@/lib/schemas/contracts";
import { label } from "@/lib/schemas/common";
import type { ContractRow } from "@/server/contracts";
import { ContractFormDialog } from "./contract-form-dialog";
import { statusVariant, urgency } from "./format";

type Opt = { value: string; label: string };

const columns: ColumnDef<ContractRow, unknown>[] = [
  {
    accessorKey: "title",
    header: "Contract",
    enableHiding: false,
    meta: { label: "Contract", className: "min-w-64" },
    cell: ({ row }) => (
      <div className="min-w-0">
        <Link href={`/contracts/${row.original.id}`} className="font-medium hover:text-gold-ink">
          {row.original.title}
        </Link>
        {row.original.is_demo && <Badge variant="outline" className="ml-2 align-middle">Demo</Badge>}
        <div className="mt-0.5 text-xs text-muted-foreground">{row.original.counterparty ?? "No counterparty set"}</div>
      </div>
    ),
  },
  {
    accessorKey: "contract_type",
    header: "Type",
    meta: { label: "Type", csv: (r) => CONTRACT_TYPE_LABEL[r.contract_type as keyof typeof CONTRACT_TYPE_LABEL] ?? r.contract_type },
    cell: ({ getValue }) => CONTRACT_TYPE_LABEL[getValue() as keyof typeof CONTRACT_TYPE_LABEL] ?? String(getValue()),
  },
  {
    accessorKey: "status",
    header: "Status",
    meta: { label: "Status", csv: (r) => label(r.status) },
    cell: ({ getValue }) => <Badge variant={statusVariant(String(getValue()))}>{label(String(getValue()))}</Badge>,
  },
  {
    id: "next",
    accessorFn: (r) => r.next_date,
    header: "Next date",
    sortUndefined: "last",
    meta: { label: "Next key date", csv: (r) => (r.next_date ? `${r.next_label}: ${r.next_date}` : "") },
    cell: ({ row }) =>
      row.original.next_date ? (
        <div className="text-xs">
          <span className={`num font-medium ${urgency(row.original.days_left)}`}>
            {fmtDate(row.original.next_date)} · {row.original.days_left} d
          </span>
          <div className="text-muted-foreground">{row.original.next_label}</div>
        </div>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    accessorKey: "end_date",
    header: "Term ends",
    sortUndefined: "last",
    meta: { label: "Term ends" },
    cell: ({ row }) => (
      <span className="num text-muted-foreground">
        {row.original.end_date ? fmtDate(row.original.end_date) : "—"}
        {row.original.renewal_type === "auto_renew" && <span className="ml-1 text-info">↻</span>}
      </span>
    ),
  },
  {
    id: "flags",
    accessorFn: (r) => r.flags.length,
    header: "Flags",
    meta: { label: "Flags", csv: (r) => r.flags.join("; ") },
    cell: ({ row }) =>
      row.original.flags.length ? (
        <span className="inline-flex items-center gap-1 text-xs text-warning" title={row.original.flags.join("\n")}>
          <AlertTriangleIcon className="size-3.5" /> {row.original.flags.length}
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">None</span>
      ),
  },
  { accessorKey: "owner", header: "Owner", meta: { label: "Owner" }, cell: ({ getValue }) => (getValue() as string) ?? "—" },
  { accessorKey: "esign_status", header: "E-signature", meta: { label: "E-signature" }, cell: ({ getValue }) => (getValue() ? label(String(getValue())) : "—") },
];

export function ContractsView({ rows, views, options }: { rows: ContractRow[]; views: SavedView[]; options: { orgs: Opt[]; people: Opt[]; documents: Opt[] } }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mx-auto max-w-[1440px]">
      <PageHeader
        title="Contracts"
        description="Every agreement Lantana is party to: terms, renewals, notice deadlines, survival periods and obligations."
        actions={
          <Button size="sm" onClick={() => setOpen(true)}>
            <PlusIcon /> New contract
          </Button>
        }
      />
      <DataTable
        module="contracts"
        columns={columns}
        data={rows}
        views={views}
        csvName="lantana-contracts"
        rowHref={(k) => `/contracts/${k.id}`}
        searchPlaceholder="Search contracts or counterparties…"
        defaultSorting={[{ id: "next", desc: false }]}
        defaultHidden={["esign_status"]}
        facets={[
          { columnId: "contract_type", label: "Types", options: CONTRACT_TYPES.map((t) => ({ value: t, label: CONTRACT_TYPE_LABEL[t] })) },
          { columnId: "status", label: "Status", options: CONTRACT_STATUSES.map((t) => ({ value: t, label: label(t) })) },
        ]}
        empty="No contracts yet. Add the first NCNDA or mandate."
      />
      <ContractFormDialog open={open} onOpenChange={setOpen} options={options} />
    </div>
  );
}
