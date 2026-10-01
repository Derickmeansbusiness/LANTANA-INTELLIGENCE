"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BanIcon, CheckCircle2Icon, Loader2Icon, PencilIcon, PlusIcon, PrinterIcon, SendIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { FormField } from "@/components/form-field";
import { todayDubai } from "@/lib/dates";
import { formatMoney, toMajor } from "@/lib/money";
import {
  addInvoiceItemAction,
  issueInvoiceAction,
  recordInvoicePaymentAction,
  removeInvoiceItemAction,
  voidInvoiceAction,
} from "@/server/actions/finance";
import { InvoiceFormDialog, type InvoiceFormValues } from "./invoice-form-dialog";

type Opt = { value: string; label: string };

export function InvoiceActions({
  id,
  status,
  initial,
  options,
}: {
  id: string;
  status: string;
  initial: InvoiceFormValues;
  options: { orgs: Opt[]; deals: Opt[]; currencies: Opt[]; incomeAccounts: Opt[]; banks: Opt[] };
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<"edit" | "pay" | null>(null);
  const [pending, start] = useTransition();
  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error);
      toast.success(msg);
      router.refresh();
    });

  return (
    <>
      <Button variant="outline" size="sm" asChild>
        <Link href={`/documents/templates/invoice?invoice_id=${id}`}>
          <PrinterIcon /> Print on letterhead
        </Link>
      </Button>
      {status === "draft" && (
        <>
          <Button variant="outline" size="sm" onClick={() => setDialog("edit")}>
            <PencilIcon /> Edit
          </Button>
          <Button size="sm" disabled={pending} onClick={() => act(() => issueInvoiceAction(id), "Issued. The amounts are now locked.")}>
            <SendIcon /> Issue
          </Button>
        </>
      )}
      {status === "sent" && (
        <Button size="sm" onClick={() => setDialog("pay")}>
          <CheckCircle2Icon /> Record payment
        </Button>
      )}
      {(status === "draft" || status === "sent") && (
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => {
            if (confirm("Void this invoice? It stays on record, marked void.")) act(() => voidInvoiceAction(id), "Invoice voided");
          }}
        >
          <BanIcon /> Void
        </Button>
      )}
      <InvoiceFormDialog open={dialog === "edit"} onOpenChange={(o) => setDialog(o ? "edit" : null)} invoiceId={id} initial={initial} options={options} />
      <PaymentDialog open={dialog === "pay"} onOpenChange={(o) => setDialog(o ? "pay" : null)} invoiceId={id} options={options} />
    </>
  );
}

function PaymentDialog({ open, onOpenChange, invoiceId, options }: { open: boolean; onOpenChange: (o: boolean) => void; invoiceId: string; options: { incomeAccounts: Opt[]; banks: Opt[] } }) {
  const router = useRouter();
  const [v, setV] = useState({ paid_on: todayDubai(), account_id: options.incomeAccounts[0]?.value ?? "", bank_account_id: options.banks[0]?.value ?? "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogTitle>Record payment</DialogTitle>
        <DialogDescription className="mt-1">Marks the invoice paid in full and adds the receipt to the ledger.</DialogDescription>
        <form
          noValidate
          className="mt-4 grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await recordInvoicePaymentAction(invoiceId, v);
              if (!r.ok) {
                setErrors(r.fieldErrors ?? {});
                return void toast.error(r.error);
              }
              toast.success("Payment recorded");
              onOpenChange(false);
              router.refresh();
            });
          }}
        >
          <FormField label="Received on" htmlFor="pay-date" error={errors.paid_on}>
            <Input id="pay-date" type="date" value={v.paid_on} onChange={(e) => setV({ ...v, paid_on: e.target.value })} />
          </FormField>
          <FormField label="Income category" htmlFor="pay-acc" error={errors.account_id}>
            <NativeSelect id="pay-acc" value={v.account_id} onChange={(e) => setV({ ...v, account_id: e.target.value })}>
              {options.incomeAccounts.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          {options.banks.length > 0 && (
            <FormField label="Into bank account" htmlFor="pay-bank">
              <NativeSelect id="pay-bank" value={v.bank_account_id} onChange={(e) => setV({ ...v, bank_account_id: e.target.value })}>
                <option value="">Not linked to a bank account</option>
                {options.banks.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              Record payment
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export type InvoiceLine = { id: string; description: string; quantity: number; unit_price_minor: number; amount_minor: number };

export function InvoiceLines({
  invoiceId,
  currency,
  lines,
  editable,
  totals,
}: {
  invoiceId: string;
  currency: string;
  lines: InvoiceLine[];
  editable: boolean;
  totals: { subtotal: number | null; vatRate: number; vat: number; total: number };
}) {
  const router = useRouter();
  const [v, setV] = useState({ description: "", quantity: "1", unit_price: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const m = (minor: number) => formatMoney(toMajor(minor, currency), currency);

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              <th scope="col" className="py-2 text-left font-normal">Description</th>
              <th scope="col" className="py-2 text-right font-normal">Qty</th>
              <th scope="col" className="py-2 text-right font-normal">Unit price</th>
              <th scope="col" className="py-2 text-right font-normal">Amount</th>
              {editable && <th className="w-10" />}
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-muted-foreground">
                  {editable ? "No lines yet. Add what you're billing for below." : "Recorded as a single total."}
                </td>
              </tr>
            )}
            {lines.map((l) => (
              <tr key={l.id} className="border-b">
                <td className="py-2 pr-3">{l.description}</td>
                <td className="num py-2 text-right">{Number(l.quantity)}</td>
                <td className="num py-2 text-right">{m(l.unit_price_minor)}</td>
                <td className="num py-2 text-right">{m(l.amount_minor)}</td>
                {editable && (
                  <td className="py-2 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Remove ${l.description}`}
                      disabled={pending}
                      onClick={() =>
                        start(async () => {
                          const r = await removeInvoiceItemAction(l.id);
                          if (!r.ok) return void toast.error(r.error);
                          router.refresh();
                        })
                      }
                    >
                      <Trash2Icon />
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot className="text-sm">
            {totals.subtotal != null && lines.length > 0 && (
              <tr>
                <td colSpan={3} className="pt-3 text-right text-muted-foreground">Subtotal</td>
                <td className="num pt-3 text-right">{m(totals.subtotal)}</td>
              </tr>
            )}
            {totals.vatRate > 0 && (
              <tr>
                <td colSpan={3} className="pt-1 text-right text-muted-foreground">VAT {Number(totals.vatRate)}%</td>
                <td className="num pt-1 text-right">{m(totals.vat)}</td>
              </tr>
            )}
            <tr className="font-medium">
              <td colSpan={3} className="pt-1 text-right">Total</td>
              <td className="num pt-1 text-right">{m(totals.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {editable && (
        <form
          noValidate
          className="grid gap-2 rounded-md border p-3 sm:grid-cols-[1fr_6rem_9rem_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await addInvoiceItemAction(invoiceId, v);
              if (!r.ok) {
                setErrors(r.fieldErrors ?? {});
                return void toast.error(r.error);
              }
              setV({ description: "", quantity: "1", unit_price: "" });
              setErrors({});
              router.refresh();
            });
          }}
        >
          <FormField label="Line" htmlFor="li-desc" error={errors.description}>
            <Input id="li-desc" value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} placeholder="e.g. Advisory retainer, October" />
          </FormField>
          <FormField label="Qty" htmlFor="li-qty" error={errors.quantity}>
            <Input id="li-qty" inputMode="decimal" value={v.quantity} onChange={(e) => setV({ ...v, quantity: e.target.value })} />
          </FormField>
          <FormField label={`Unit price (${currency})`} htmlFor="li-price" error={errors.unit_price}>
            <Input id="li-price" inputMode="decimal" value={v.unit_price} onChange={(e) => setV({ ...v, unit_price: e.target.value })} />
          </FormField>
          <Button type="submit" variant="outline" disabled={pending}>
            {pending ? <Loader2Icon className="animate-spin" /> : <PlusIcon />} Add line
          </Button>
        </form>
      )}
    </div>
  );
}
