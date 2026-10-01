"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { BanIcon, CheckCircle2Icon, MoreHorizontalIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/form-field";
import { DataTable } from "@/components/data-table/data-table";
import type { SavedView } from "@/components/data-table/types";
import { fmtDate, shiftDate, todayDubai } from "@/lib/dates";
import { formatMoney, toMajor } from "@/lib/money";
import { BILL_STATUSES } from "@/lib/schemas/finance";
import { label } from "@/lib/schemas/common";
import type { BillRow } from "@/server/finance";
import { createBillAction, payBillAction, voidBillAction } from "@/server/actions/finance";
import { agingLabel, billStatusVariant } from "./format";

type Opt = { value: string; label: string };
type Options = { orgs: Opt[]; expenseAccounts: Opt[]; currencies: Opt[]; banks: Opt[] };

export function BillsView({ rows, views, options }: { rows: BillRow[]; views: SavedView[]; options: Options }) {
  const [newOpen, setNewOpen] = useState(false);
  const [paying, setPaying] = useState<BillRow | null>(null);
  const router = useRouter();
  const [, start] = useTransition();

  const columns: ColumnDef<BillRow, unknown>[] = [
    {
      accessorKey: "description",
      header: "Bill",
      enableHiding: false,
      meta: { label: "Bill", className: "min-w-56" },
      cell: ({ row }) => (
        <div className="min-w-0">
          <span className="font-medium">{row.original.description}</span>
          {row.original.is_demo && <Badge variant="outline" className="ml-2 align-middle">Demo</Badge>}
          <div className="mt-0.5 text-xs text-muted-foreground">{[row.original.supplier, row.original.reference].filter(Boolean).join(" · ")}</div>
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      meta: { label: "Status", csv: (r) => label(r.status) },
      cell: ({ row }) => (
        <div className="flex flex-wrap items-center gap-1">
          <Badge variant={billStatusVariant(row.original.status, row.original.aging)}>{label(row.original.status)}</Badge>
          {row.original.aging && row.original.aging !== "current" && <span className="text-xs text-danger">{agingLabel(row.original.aging)}</span>}
        </div>
      ),
    },
    { accessorKey: "account", header: "Category", meta: { label: "Category" }, cell: ({ getValue }) => (getValue() as string) ?? "—" },
    { accessorKey: "due_date", header: "Due", meta: { label: "Due" }, cell: ({ getValue }) => <span className="num">{fmtDate(String(getValue()))}</span> },
    {
      id: "total",
      accessorFn: (r) => toMajor(r.total_minor, r.currency),
      header: "Amount",
      meta: { label: "Amount", csv: (r) => `${toMajor(r.total_minor, r.currency)} ${r.currency}` },
      cell: ({ row }) => <span className="num whitespace-nowrap">{formatMoney(toMajor(row.original.total_minor, row.original.currency), row.original.currency)}</span>,
    },
    {
      id: "actions",
      header: "",
      enableHiding: false,
      enableSorting: false,
      meta: { label: "Actions" },
      cell: ({ row }) =>
        row.original.status === "open" ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" aria-label={`Actions for ${row.original.description}`} onClick={(e) => e.stopPropagation()}>
                <MoreHorizontalIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setPaying(row.original)}>
                <CheckCircle2Icon /> Mark paid
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() =>
                  start(async () => {
                    const r = await voidBillAction(row.original.id);
                    if (!r.ok) return void toast.error(r.error);
                    toast.success("Bill voided");
                    router.refresh();
                  })
                }
              >
                <BanIcon /> Void
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : row.original.paid_at ? (
          <span className="num text-xs text-muted-foreground">Paid {fmtDate(row.original.paid_at)}</span>
        ) : null,
    },
  ];

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">What Lantana owes suppliers. Marking a bill paid adds the payment to the ledger.</p>
        <Button size="sm" onClick={() => setNewOpen(true)}>
          <PlusIcon /> New bill
        </Button>
      </div>
      <DataTable
        module="bills"
        columns={columns}
        data={rows}
        views={views}
        csvName="lantana-bills"
        searchPlaceholder="Search bills or suppliers…"
        defaultSorting={[{ id: "due_date", desc: true }]}
        facets={[{ columnId: "status", label: "Status", options: BILL_STATUSES.map((s) => ({ value: s, label: label(s) })) }]}
        empty="No bills recorded."
      />
      <BillDialog open={newOpen} onOpenChange={setNewOpen} options={options} />
      {paying && <PayBillDialog bill={paying} banks={options.banks} onClose={() => setPaying(null)} />}
    </>
  );
}

function BillDialog({ open, onOpenChange, options }: { open: boolean; onOpenChange: (o: boolean) => void; options: Options }) {
  const router = useRouter();
  const today = todayDubai();
  const empty = { supplier_org_id: "", supplier_name: "", reference: "", description: "", account_id: "", issue_date: today, due_date: shiftDate(today, 30), currency: "AED", total: "", notes: "" };
  const [v, setV] = useState(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const set = (k: keyof typeof v, val: string) => setV((s) => ({ ...s, [k]: val }));
  return (
    <Dialog open={open} onOpenChange={(o) => (onOpenChange(o), !o && setErrors({}))}>
      <DialogContent className="top-[6vh] max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogTitle>New bill</DialogTitle>
        <DialogDescription className="mt-1">A supplier invoice Lantana has to pay.</DialogDescription>
        <form
          noValidate
          className="mt-5 grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await createBillAction(v);
              if (!r.ok) {
                setErrors(r.fieldErrors ?? {});
                return void toast.error(r.error);
              }
              toast.success("Bill recorded");
              setV(empty);
              onOpenChange(false);
              router.refresh();
            });
          }}
        >
          <FormField label="What is it for?" htmlFor="bill-desc" error={errors.description} className="sm:col-span-2">
            <Input id="bill-desc" value={v.description} onChange={(e) => set("description", e.target.value)} maxLength={300} />
          </FormField>
          <FormField label="Supplier" htmlFor="bill-org">
            <NativeSelect id="bill-org" value={v.supplier_org_id} onChange={(e) => set("supplier_org_id", e.target.value)}>
              <option value="">Not in Partners (type a name)</option>
              {options.orgs.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="Supplier name" htmlFor="bill-sup" error={errors.supplier_name}>
            <Input id="bill-sup" value={v.supplier_name} onChange={(e) => set("supplier_name", e.target.value)} disabled={Boolean(v.supplier_org_id)} />
          </FormField>
          <FormField label="Their invoice no." htmlFor="bill-ref">
            <Input id="bill-ref" value={v.reference} onChange={(e) => set("reference", e.target.value)} maxLength={120} />
          </FormField>
          <FormField label="Category" htmlFor="bill-acc">
            <NativeSelect id="bill-acc" value={v.account_id} onChange={(e) => set("account_id", e.target.value)}>
              <option value="">Not categorised</option>
              {options.expenseAccounts.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="Dated" htmlFor="bill-issue" error={errors.issue_date}>
            <Input id="bill-issue" type="date" value={v.issue_date} onChange={(e) => set("issue_date", e.target.value)} />
          </FormField>
          <FormField label="Due" htmlFor="bill-due" error={errors.due_date}>
            <Input id="bill-due" type="date" value={v.due_date} onChange={(e) => set("due_date", e.target.value)} />
          </FormField>
          <FormField label="Amount" htmlFor="bill-total" error={errors.total}>
            <Input id="bill-total" inputMode="decimal" value={v.total} onChange={(e) => set("total", e.target.value)} />
          </FormField>
          <FormField label="Currency" htmlFor="bill-cur">
            <NativeSelect id="bill-cur" value={v.currency} onChange={(e) => set("currency", e.target.value)}>
              {options.currencies.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="Notes" htmlFor="bill-notes" className="sm:col-span-2">
            <Textarea id="bill-notes" rows={2} value={v.notes} onChange={(e) => set("notes", e.target.value)} />
          </FormField>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              Record bill
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PayBillDialog({ bill, banks, onClose }: { bill: BillRow; banks: Opt[]; onClose: () => void }) {
  const router = useRouter();
  const [v, setV] = useState({ paid_on: todayDubai(), bank_account_id: banks[0]?.value ?? "" });
  const [pending, start] = useTransition();
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogTitle>Mark paid</DialogTitle>
        <DialogDescription className="mt-1">
          {bill.description} · {formatMoney(toMajor(bill.total_minor, bill.currency), bill.currency)}
        </DialogDescription>
        <form
          noValidate
          className="mt-4 grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await payBillAction(bill.id, v);
              if (!r.ok) return void toast.error(r.error);
              toast.success("Bill paid and added to the ledger");
              onClose();
              router.refresh();
            });
          }}
        >
          <FormField label="Paid on" htmlFor="pb-date">
            <Input id="pb-date" type="date" value={v.paid_on} onChange={(e) => setV({ ...v, paid_on: e.target.value })} />
          </FormField>
          {banks.length > 0 && (
            <FormField label="From bank account" htmlFor="pb-bank">
              <NativeSelect id="pb-bank" value={v.bank_account_id} onChange={(e) => setV({ ...v, bank_account_id: e.target.value })}>
                <option value="">Not linked to a bank account</option>
                {banks.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              Mark paid
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
