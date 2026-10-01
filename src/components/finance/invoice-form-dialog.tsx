"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/form-field";
import { shiftDate, todayDubai } from "@/lib/dates";
import { INVOICE_KINDS } from "@/lib/schemas/finance";
import { label } from "@/lib/schemas/common";
import { createInvoiceAction, updateInvoiceAction } from "@/server/actions/finance";

type Opt = { value: string; label: string };
export type InvoiceFormValues = {
  organization_id: string;
  deal_id: string;
  kind: string;
  issue_date: string;
  due_date: string;
  currency: string;
  vat_rate: string;
  reference: string;
  notes: string;
};

export function InvoiceFormDialog({
  open,
  onOpenChange,
  invoiceId,
  initial,
  options,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  invoiceId?: string;
  initial?: InvoiceFormValues;
  options: { orgs: Opt[]; deals: Opt[]; currencies: Opt[] };
}) {
  const router = useRouter();
  const today = todayDubai();
  const [v, setV] = useState<InvoiceFormValues>(
    initial ?? { organization_id: "", deal_id: "", kind: "advisory", issue_date: today, due_date: shiftDate(today, 30), currency: "USD", vat_rate: "0", reference: "", notes: "" },
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const set = (k: keyof InvoiceFormValues, val: string) => setV((s) => ({ ...s, [k]: val }));

  return (
    <Dialog open={open} onOpenChange={(o) => (onOpenChange(o), !o && setErrors({}))}>
      <DialogContent className="top-[6vh] max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogTitle>{invoiceId ? "Edit invoice" : "New invoice"}</DialogTitle>
        <DialogDescription className="mt-1">
          {invoiceId ? "Only drafts can change." : "Starts as a draft with the next number. Add lines, then issue it."}
        </DialogDescription>
        <form
          noValidate
          className="mt-5 grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = invoiceId ? await updateInvoiceAction(invoiceId, v) : await createInvoiceAction(v);
              if (!r.ok) {
                setErrors(r.fieldErrors ?? {});
                return void toast.error(r.error);
              }
              onOpenChange(false);
              if (!invoiceId && r.data && typeof r.data === "object" && "id" in r.data) router.push(`/finance/invoices/${(r.data as { id: string }).id}`);
              else router.refresh();
            });
          }}
        >
          <FormField label="Bill to" htmlFor="inv-org" error={errors.organization_id} className="sm:col-span-2">
            <NativeSelect id="inv-org" value={v.organization_id} onChange={(e) => set("organization_id", e.target.value)}>
              <option value="">Choose an organization…</option>
              {options.orgs.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="Kind" htmlFor="inv-kind">
            <NativeSelect id="inv-kind" value={v.kind} onChange={(e) => set("kind", e.target.value)}>
              {INVOICE_KINDS.map((k) => (
                <option key={k} value={k}>
                  {label(k)}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="Deal" htmlFor="inv-deal">
            <NativeSelect id="inv-deal" value={v.deal_id} onChange={(e) => set("deal_id", e.target.value)}>
              <option value="">None</option>
              {options.deals.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="Issue date" htmlFor="inv-issue" error={errors.issue_date}>
            <Input id="inv-issue" type="date" value={v.issue_date} onChange={(e) => set("issue_date", e.target.value)} />
          </FormField>
          <FormField label="Due date" htmlFor="inv-due" error={errors.due_date}>
            <Input id="inv-due" type="date" value={v.due_date} onChange={(e) => set("due_date", e.target.value)} />
          </FormField>
          <FormField label="Currency" htmlFor="inv-cur">
            <NativeSelect id="inv-cur" value={v.currency} onChange={(e) => set("currency", e.target.value)}>
              {options.currencies.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="VAT %" htmlFor="inv-vat" error={errors.vat_rate} hint="5 if Lantana is VAT-registered and the supply is taxable; 0 otherwise.">
            <Input id="inv-vat" inputMode="decimal" value={v.vat_rate} onChange={(e) => set("vat_rate", e.target.value)} />
          </FormField>
          <FormField label="Client reference (PO)" htmlFor="inv-ref" className="sm:col-span-2">
            <Input id="inv-ref" value={v.reference} onChange={(e) => set("reference", e.target.value)} maxLength={120} />
          </FormField>
          <FormField label="Internal notes" htmlFor="inv-notes" className="sm:col-span-2">
            <Textarea id="inv-notes" rows={2} value={v.notes} onChange={(e) => set("notes", e.target.value)} />
          </FormField>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {invoiceId ? "Save" : "Create draft"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
