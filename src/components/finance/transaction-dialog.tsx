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
import { todayDubai } from "@/lib/dates";
import { createTransactionAction } from "@/server/actions/finance";

type Opt = { value: string; label: string };

export function TransactionDialog({
  open,
  onOpenChange,
  options,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  options: { accounts: (Opt & { type: string })[]; banks: (Opt & { currency: string })[]; currencies: Opt[]; orgs: Opt[] };
}) {
  const router = useRouter();
  const empty = { txn_date: todayDubai(), description: "", amount: "", direction: "out", currency: "AED", account_id: "", bank_account_id: "", counterparty_org_id: "", reference: "", notes: "" };
  const [v, setV] = useState(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const set = (k: keyof typeof v, val: string) => setV((s) => ({ ...s, [k]: val }));

  return (
    <Dialog open={open} onOpenChange={(o) => (onOpenChange(o), !o && setErrors({}))}>
      <DialogContent className="top-[6vh] max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogTitle>New transaction</DialogTitle>
        <DialogDescription className="mt-1">For one-off entries. Bank statements are faster through Import.</DialogDescription>
        <form
          noValidate
          className="mt-5 grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await createTransactionAction(v);
              if (!r.ok) {
                setErrors(r.fieldErrors ?? {});
                return void toast.error(r.error);
              }
              toast.success("Transaction recorded");
              setV(empty);
              onOpenChange(false);
              router.refresh();
            });
          }}
        >
          <FormField label="Description" htmlFor="tx-desc" error={errors.description} className="sm:col-span-2">
            <Input id="tx-desc" value={v.description} onChange={(e) => set("description", e.target.value)} maxLength={300} />
          </FormField>
          <FormField label="Date" htmlFor="tx-date" error={errors.txn_date}>
            <Input id="tx-date" type="date" value={v.txn_date} onChange={(e) => set("txn_date", e.target.value)} />
          </FormField>
          <FormField label="Money" htmlFor="tx-dir">
            <NativeSelect id="tx-dir" value={v.direction} onChange={(e) => set("direction", e.target.value)}>
              <option value="out">Out (a cost or payment)</option>
              <option value="in">In (income or receipt)</option>
            </NativeSelect>
          </FormField>
          <FormField label="Amount" htmlFor="tx-amt" error={errors.amount}>
            <Input id="tx-amt" inputMode="decimal" value={v.amount} onChange={(e) => set("amount", e.target.value)} placeholder="2,500.00" />
          </FormField>
          <FormField label="Currency" htmlFor="tx-cur" error={errors.currency}>
            <NativeSelect id="tx-cur" value={v.currency} onChange={(e) => set("currency", e.target.value)}>
              {options.currencies.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="Category" htmlFor="tx-acc" error={errors.account_id}>
            <NativeSelect id="tx-acc" value={v.account_id} onChange={(e) => set("account_id", e.target.value)}>
              <option value="">Not categorised yet</option>
              {options.accounts.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          {options.banks.length > 0 && (
            <FormField label="Bank account" htmlFor="tx-bank" hint="Counts toward cash on hand.">
              <NativeSelect id="tx-bank" value={v.bank_account_id} onChange={(e) => set("bank_account_id", e.target.value)}>
                <option value="">None (ledger only)</option>
                {options.banks.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
          )}
          <FormField label="Counterparty" htmlFor="tx-org">
            <NativeSelect id="tx-org" value={v.counterparty_org_id} onChange={(e) => set("counterparty_org_id", e.target.value)}>
              <option value="">None</option>
              {options.orgs.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="Reference" htmlFor="tx-ref">
            <Input id="tx-ref" value={v.reference} onChange={(e) => set("reference", e.target.value)} maxLength={120} />
          </FormField>
          <FormField label="Notes" htmlFor="tx-notes" className="sm:col-span-2">
            <Textarea id="tx-notes" rows={2} value={v.notes} onChange={(e) => set("notes", e.target.value)} />
          </FormField>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              Record
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
