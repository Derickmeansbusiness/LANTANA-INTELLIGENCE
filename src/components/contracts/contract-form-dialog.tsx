"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/form-field";
import { CONTRACT_STATUSES, CONTRACT_TYPES, CONTRACT_TYPE_LABEL, ESIGN_STATUSES } from "@/lib/schemas/contracts";
import { label } from "@/lib/schemas/common";
import { addMonths } from "@/lib/contract-dates";
import { createContractAction, updateContractAction } from "@/server/actions/contracts";

type Opt = { value: string; label: string };

export type ContractFormValues = {
  title: string;
  contract_type: string;
  status: string;
  counterparty_org_id: string;
  document_id: string;
  owner_id: string;
  effective_date: string;
  term_months: string;
  end_date: string;
  renewal_type: string;
  notice_period_days: string;
  governing_law: string;
  forum: string;
  exclusivity: string;
  fee_terms: string;
  signatory_name: string;
  signatory_confirmed: boolean;
  signing_authority_confirmed: boolean;
  counterparty_address_confirmed: boolean;
  esign_status: string;
  notes: string;
};

const EMPTY: ContractFormValues = {
  title: "",
  contract_type: "ncnda",
  status: "draft",
  counterparty_org_id: "",
  document_id: "",
  owner_id: "",
  effective_date: "",
  term_months: "",
  end_date: "",
  renewal_type: "fixed",
  notice_period_days: "",
  governing_law: "",
  forum: "",
  exclusivity: "",
  fee_terms: "",
  signatory_name: "",
  signatory_confirmed: false,
  signing_authority_confirmed: false,
  counterparty_address_confirmed: true,
  esign_status: "",
  notes: "",
};

/** End of term from start + months (same month arithmetic as the alert job). */
function endFrom(start: string, months: string) {
  const m = Number(months);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !Number.isInteger(m) || m <= 0) return "";
  return addMonths(start, m);
}

export function ContractFormDialog({
  open,
  onOpenChange,
  contractId,
  initial,
  options,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  contractId?: string;
  initial?: Partial<ContractFormValues>;
  options: { orgs: Opt[]; people: Opt[]; documents: Opt[] };
}) {
  const router = useRouter();
  const [v, setV] = useState<ContractFormValues>({ ...EMPTY, ...initial });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const set = <K extends keyof ContractFormValues>(k: K, val: ContractFormValues[K]) => setV((s) => ({ ...s, [k]: val }));
  const text = (k: keyof ContractFormValues, lbl: string, o: { type?: string; wide?: boolean; hint?: string } = {}) => (
    <FormField label={lbl} htmlFor={`k-${k}`} error={errors[k]} hint={o.hint} className={o.wide ? "sm:col-span-2" : undefined}>
      <Input id={`k-${k}`} type={o.type ?? "text"} value={v[k] as string} onChange={(e) => set(k, e.target.value as never)} aria-invalid={!!errors[k]} />
    </FormField>
  );
  const check = (k: "signatory_confirmed" | "signing_authority_confirmed" | "counterparty_address_confirmed", lbl: string) => (
    <div className="flex items-center gap-2">
      <Checkbox id={`k-${k}`} checked={v[k]} onCheckedChange={(c) => set(k, c === true)} />
      <Label htmlFor={`k-${k}`}>{lbl}</Label>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => (onOpenChange(o), !o && setErrors({}))}>
      <DialogContent className="top-[4vh] max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogTitle>{contractId ? "Edit contract" : "New contract"}</DialogTitle>
        <DialogDescription className="mt-1">Dates drive the expiry alerts at 90, 60, 30 and 7 days. Unconfirmed items stay flagged until someone confirms them.</DialogDescription>
        <form
          noValidate
          className="mt-5 grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = contractId ? await updateContractAction(contractId, v) : await createContractAction(v);
              if (!r.ok) {
                setErrors(r.fieldErrors ?? {});
                return void toast.error(r.error);
              }
              toast.success(contractId ? "Contract updated" : "Contract added");
              onOpenChange(false);
              if (!contractId && r.data && typeof r.data === "object" && "id" in r.data) router.push(`/contracts/${(r.data as { id: string }).id}`);
              else router.refresh();
            });
          }}
        >
          {text("title", "Title", { wide: true })}
          <FormField label="Type" htmlFor="k-type">
            <NativeSelect id="k-type" value={v.contract_type} onChange={(e) => set("contract_type", e.target.value)}>
              {CONTRACT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {CONTRACT_TYPE_LABEL[t]}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="Status" htmlFor="k-status">
            <NativeSelect id="k-status" value={v.status} onChange={(e) => set("status", e.target.value)}>
              {CONTRACT_STATUSES.map((t) => (
                <option key={t} value={t}>
                  {label(t)}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="Counterparty" htmlFor="k-org">
            <NativeSelect id="k-org" value={v.counterparty_org_id} onChange={(e) => set("counterparty_org_id", e.target.value)}>
              <option value="">Not set</option>
              {options.orgs.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="Owner at Lantana" htmlFor="k-owner" hint="Gets the alerts and obligation tasks. Defaults to you.">
            <NativeSelect id="k-owner" value={v.owner_id} onChange={(e) => set("owner_id", e.target.value)}>
              <option value="">{contractId ? "Not set" : "Me"}</option>
              {options.people.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="Effective date" htmlFor="k-effective_date" error={errors.effective_date}>
            <Input
              id="k-effective_date"
              type="date"
              value={v.effective_date}
              onChange={(e) => setV((s) => ({ ...s, effective_date: e.target.value, end_date: s.end_date || endFrom(e.target.value, s.term_months) }))}
            />
          </FormField>
          <FormField label="Term (months)" htmlFor="k-term_months" error={errors.term_months}>
            <Input
              id="k-term_months"
              type="number"
              min={0}
              value={v.term_months}
              onChange={(e) => setV((s) => ({ ...s, term_months: e.target.value, end_date: endFrom(s.effective_date, e.target.value) || s.end_date }))}
            />
          </FormField>
          {text("end_date", "End of current term", { type: "date", hint: "Filled from start + term; edit if the contract says otherwise." })}
          <FormField label="Renewal" htmlFor="k-renewal">
            <NativeSelect id="k-renewal" value={v.renewal_type} onChange={(e) => set("renewal_type", e.target.value)}>
              <option value="fixed">Fixed term</option>
              <option value="auto_renew">Renews automatically</option>
            </NativeSelect>
          </FormField>
          {text("notice_period_days", "Notice period (days)", { type: "number", hint: v.renewal_type === "auto_renew" ? "Alerts count down to the last day to give notice." : undefined })}
          <FormField label="E-signature" htmlFor="k-esign">
            <NativeSelect id="k-esign" value={v.esign_status} onChange={(e) => set("esign_status", e.target.value)}>
              <option value="">Not tracked</option>
              {ESIGN_STATUSES.map((t) => (
                <option key={t} value={t}>
                  {label(t)}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          {text("governing_law", "Governing law")}
          {text("forum", "Disputes forum")}
          {text("exclusivity", "Exclusivity")}
          {text("signatory_name", "Counterparty signatory")}
          <FormField label="Fee terms" htmlFor="k-fee" className="sm:col-span-2">
            <Textarea id="k-fee" rows={2} value={v.fee_terms} onChange={(e) => set("fee_terms", e.target.value)} />
          </FormField>
          <FormField label="Signed copy in the vault" htmlFor="k-doc" className="sm:col-span-2">
            <NativeSelect id="k-doc" value={v.document_id} onChange={(e) => set("document_id", e.target.value)}>
              <option value="">None yet</option>
              {options.documents.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <fieldset className="space-y-2 sm:col-span-2">
            <legend className="text-xs font-medium text-muted-foreground">Confirmed</legend>
            {check("signing_authority_confirmed", "Counterparty signatory is authorised to bind them")}
            {check("signatory_confirmed", "Signatory identity confirmed")}
            {check("counterparty_address_confirmed", "Counterparty registered address confirmed")}
          </fieldset>
          <FormField label="Notes" htmlFor="k-notes" className="sm:col-span-2">
            <Textarea id="k-notes" rows={3} value={v.notes} onChange={(e) => set("notes", e.target.value)} />
          </FormField>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2Icon className="animate-spin" />} {contractId ? "Save" : "Add contract"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
