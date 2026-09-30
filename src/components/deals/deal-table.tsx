"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data-table/data-table";
import type { SavedView } from "@/components/data-table/types";
import { formatCompact, formatMoney } from "@/lib/money";
import { fmtDate } from "@/lib/dates";
import { SECTORS, label } from "@/lib/schemas/common";
import type { DealRow } from "@/server/deals";

const columns: ColumnDef<DealRow, unknown>[] = [
  {
    accessorKey: "name",
    header: "Deal",
    enableHiding: false,
    meta: { label: "Deal", className: "min-w-56" },
    cell: ({ row }) => (
      <Link href={`/deals/${row.original.id}`} className="font-medium hover:text-gold-ink">
        {row.original.name}
        {row.original.is_demo && (
          <Badge variant="outline" className="ml-2 align-middle">
            Demo
          </Badge>
        )}
      </Link>
    ),
  },
  {
    accessorKey: "stage",
    header: "Stage",
    meta: { label: "Stage", csv: (r) => r.stage_label },
    sortingFn: (a, b) => a.original.stage_order - b.original.stage_order,
    cell: ({ row }) => <Badge variant={row.original.is_terminal ? "outline" : "gold"}>{row.original.stage_label}</Badge>,
  },
  { accessorKey: "sector", header: "Sector", meta: { label: "Sector", csv: (r) => label(r.sector) }, cell: ({ getValue }) => label(String(getValue())) },
  { accessorKey: "country_name", header: "Country", meta: { label: "Country" }, cell: ({ getValue }) => (getValue() as string) ?? "—" },
  {
    accessorKey: "value_usd",
    header: "Value (USD)",
    meta: { label: "Value (USD)", align: "right", csv: (r) => (r.value_usd == null ? "" : Math.round(r.value_usd)) },
    sortUndefined: "last",
    cell: ({ row }) => (row.original.value_usd == null ? "—" : formatCompact(row.original.value_usd, "USD")),
  },
  {
    id: "ticket",
    accessorFn: (r) => r.ticket_major,
    header: "Ticket (original)",
    meta: { label: "Ticket (original)", align: "right", csv: (r) => (r.ticket_major == null ? "" : formatMoney(r.ticket_major, r.currency)) },
    cell: ({ row }) => (row.original.ticket_major == null ? "—" : formatMoney(row.original.ticket_major, row.original.currency)),
  },
  { accessorKey: "probability", header: "Prob.", meta: { label: "Probability %", align: "right" }, cell: ({ getValue }) => `${getValue()}%` },
  {
    accessorKey: "weighted_usd",
    header: "Weighted",
    meta: { label: "Weighted (USD)", align: "right", csv: (r) => (r.weighted_usd == null ? "" : Math.round(r.weighted_usd)) },
    cell: ({ row }) => (row.original.weighted_usd == null ? "—" : formatCompact(row.original.weighted_usd, "USD")),
  },
  { accessorKey: "owner_name", header: "Owner", meta: { label: "Owner" }, cell: ({ getValue }) => (getValue() as string) ?? "—" },
  { accessorKey: "introducer", header: "Introduced by", meta: { label: "Introduced by" }, cell: ({ getValue }) => (getValue() as string) ?? "—" },
  { accessorKey: "project_owner", header: "Project owner", meta: { label: "Project owner" }, cell: ({ getValue }) => (getValue() as string) ?? "—" },
  { accessorKey: "next_step", header: "Next step", meta: { label: "Next step", className: "max-w-64 truncate" }, cell: ({ getValue }) => (getValue() as string) ?? "—" },
  {
    accessorKey: "expected_close_date",
    header: "Expected close",
    meta: { label: "Expected close" },
    sortUndefined: "last",
    cell: ({ getValue }) => <span className="num">{fmtDate(getValue() as string) || "—"}</span>,
  },
];

export function DealTable({
  deals,
  views,
  stages,
  countries,
  owners,
}: {
  deals: DealRow[];
  views: SavedView[];
  stages: { key: string; label: string }[];
  countries: { value: string; label: string }[];
  owners: { value: string; label: string }[];
}) {
  const usedCountries = countries.filter((c) => deals.some((d) => d.country === c.value));
  return (
    <DataTable
      module="deals"
      columns={columns}
      data={deals}
      views={views}
      csvName="lantana-deals"
      rowHref={(d) => `/deals/${d.id}`}
      searchPlaceholder="Search deals…"
      defaultSorting={[{ id: "stage", desc: false }]}
      defaultHidden={["ticket", "project_owner", "expected_close_date"]}
      facets={[
        { columnId: "stage", label: "Stages", options: stages.map((s) => ({ value: s.key, label: s.label })) },
        { columnId: "sector", label: "Sectors", options: SECTORS.map((s) => ({ value: s, label: label(s) })) },
        { columnId: "country_name", label: "Countries", options: usedCountries.map((c) => ({ value: c.label, label: c.label })) },
        { columnId: "owner_name", label: "Owners", options: owners.map((o) => ({ value: o.label, label: o.label })) },
      ]}
      empty="No deals yet. Create the first one with New deal."
    />
  );
}
