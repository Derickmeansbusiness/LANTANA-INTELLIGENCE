"use client";

import { useState } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { PlusIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table/data-table";
import type { SavedView } from "@/components/data-table/types";
import { fmtDate } from "@/lib/dates";
import { formatMoney, toMajor } from "@/lib/money";
import { INVOICE_STATUSES } from "@/lib/schemas/finance";
import { label } from "@/lib/schemas/common";
import type { InvoiceRow } from "@/server/finance";
import { InvoiceFormDialog } from "./invoice-form-dialog";
import { agingLabel, invoiceStatusVariant } from "./format";

type Opt = { value: string; label: string };

const columns: ColumnDef<InvoiceRow, unknown>[] = [
  {
    accessorKey: "invoice_no",
    header: "Invoice",
    enableHiding: false,
    meta: { label: "Invoice" },
    cell: ({ row }) => (
      <div className="min-w-0">
        <Link href={`/finance/invoices/${row.original.id}`} className="num font-medium hover:text-gold-ink">
          {row.original.invoice_no}
        </Link>
        {row.original.is_demo && <Badge variant="outline" className="ml-2 align-middle">Demo</Badge>}
        <div className="mt-0.5 text-xs text-muted-foreground">{[row.original.client, row.original.deal].filter(Boolean).join(" · ") || "—"}</div>
      </div>
    ),
  },
  { accessorKey: "kind", header: "Kind", meta: { label: "Kind", csv: (r) => label(r.kind) }, cell: ({ getValue }) => label(String(getValue())) },
  {
    accessorKey: "status",
    header: "Status",
    meta: { label: "Status", csv: (r) => label(r.status) },
    cell: ({ row }) => (
      <div className="flex flex-wrap items-center gap-1">
        <Badge variant={invoiceStatusVariant(row.original.status, row.original.aging)}>{label(row.original.status)}</Badge>
        {row.original.aging && row.original.aging !== "current" && <span className="text-xs text-danger">{agingLabel(row.original.aging)}</span>}
      </div>
    ),
  },
  { accessorKey: "issue_date", header: "Issued", meta: { label: "Issued" }, cell: ({ getValue }) => <span className="num">{fmtDate(String(getValue()))}</span> },
  { accessorKey: "due_date", header: "Due", meta: { label: "Due" }, cell: ({ getValue }) => <span className="num">{fmtDate(String(getValue()))}</span> },
  {
    id: "total",
    accessorFn: (r) => toMajor(r.total_minor, r.currency),
    header: "Total",
    meta: { label: "Total", csv: (r) => `${toMajor(r.total_minor, r.currency)} ${r.currency}` },
    cell: ({ row }) => <span className="num whitespace-nowrap">{formatMoney(toMajor(row.original.total_minor, row.original.currency), row.original.currency)}</span>,
  },
];

export function InvoicesView({ rows, views, options }: { rows: InvoiceRow[]; views: SavedView[]; options: { orgs: Opt[]; deals: Opt[]; currencies: Opt[] } }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Invoices print on the letterhead from the record. Amounts are never typed into the template.</p>
        <Button size="sm" onClick={() => setOpen(true)}>
          <PlusIcon /> New invoice
        </Button>
      </div>
      <DataTable
        module="invoices"
        columns={columns}
        data={rows}
        views={views}
        csvName="lantana-invoices"
        rowHref={(i) => `/finance/invoices/${i.id}`}
        searchPlaceholder="Search invoices or clients…"
        defaultSorting={[{ id: "issue_date", desc: true }]}
        facets={[{ columnId: "status", label: "Status", options: INVOICE_STATUSES.map((s) => ({ value: s, label: label(s) })) }]}
        empty="No invoices yet."
      />
      <InvoiceFormDialog open={open} onOpenChange={setOpen} options={options} />
    </>
  );
}
