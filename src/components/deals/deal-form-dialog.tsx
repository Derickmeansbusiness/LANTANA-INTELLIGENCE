"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/form-field";
import { SECTORS, label } from "@/lib/schemas/common";
import { createDealAction, updateDealAction } from "@/server/actions/deals";

export type DealFormOptions = {
  stages: { key: string; label: string; is_terminal: boolean }[];
  people: { value: string; label: string }[];
  orgs: { value: string; label: string; type: string }[];
  countries: { value: string; label: string }[];
  currencies: { value: string; label: string }[];
};

export type DealFormValues = {
  name: string;
  sector: string;
  country: string;
  ticket: string;
  currency: string;
  stage: string;
  probability: string;
  expected_close_date: string;
  owner_id: string;
  project_owner_org_id: string;
  introducer_org_id: string;
  fee_terms: string;
  spv_planned: boolean;
  next_step: string;
  next_step_due: string;
  summary: string;
};

const EMPTY: DealFormValues = {
  name: "",
  sector: "",
  country: "",
  ticket: "",
  currency: "USD",
  stage: "lead",
  probability: "",
  expected_close_date: "",
  owner_id: "",
  project_owner_org_id: "",
  introducer_org_id: "",
  fee_terms: "",
  spv_planned: false,
  next_step: "",
  next_step_due: "",
  summary: "",
};

export function DealFormDialog({
  open,
  onOpenChange,
  options,
  dealId,
  initial,
  defaultOwnerId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  options: DealFormOptions;
  /** When set, the dialog edits this deal; otherwise it creates one. */
  dealId?: string;
  initial?: Partial<DealFormValues>;
  defaultOwnerId?: string;
}) {
  const router = useRouter();
  const [v, setV] = useState<DealFormValues>({ ...EMPTY, owner_id: defaultOwnerId ?? "", ...initial });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const set = <K extends keyof DealFormValues>(k: K, val: DealFormValues[K]) => setV((s) => ({ ...s, [k]: val }));
  const editing = Boolean(dealId);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const r = editing ? await updateDealAction(dealId!, v) : await createDealAction(v);
      if (!r.ok) {
        setErrors(r.fieldErrors ?? {});
        toast.error(r.error);
        return;
      }
      toast.success(editing ? "Deal updated" : "Deal created");
      onOpenChange(false);
      if (!editing && r.data && typeof r.data === "object" && "id" in r.data) router.push(`/deals/${(r.data as { id: string }).id}`);
      else router.refresh();
    });
  }

  const err = (k: string) => errors[k];
  const openStages = options.stages.filter((s) => !s.is_terminal);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setErrors({});
      }}
    >
      <DialogContent className="top-[5vh] max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogTitle>{editing ? "Edit deal" : "New deal"}</DialogTitle>
        <DialogDescription className="mt-1">
          {editing ? "Stage changes go through Move stage so the history keeps a reason." : "Only the name and sector are required. You can fill in the rest as it firms up."}
        </DialogDescription>
        <form onSubmit={submit} className="mt-5 grid gap-4 sm:grid-cols-2" noValidate>
          <FormField label="Deal name" htmlFor="deal-name" error={err("name")} className="sm:col-span-2">
            <Input id="deal-name" value={v.name} onChange={(e) => set("name", e.target.value)} aria-invalid={!!err("name")} autoFocus required />
          </FormField>
          <FormField label="Sector" htmlFor="deal-sector" error={err("sector")}>
            <NativeSelect id="deal-sector" value={v.sector} onChange={(e) => set("sector", e.target.value)} aria-invalid={!!err("sector")} required>
              <option value="">Choose…</option>
              {SECTORS.map((s) => (
                <option key={s} value={s}>
                  {label(s)}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="Country" htmlFor="deal-country" error={err("country")}>
            <NativeSelect id="deal-country" value={v.country} onChange={(e) => set("country", e.target.value)}>
              <option value="">Not set</option>
              {options.countries.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="Ticket size" htmlFor="deal-ticket" error={err("ticket")} hint="In the currency on the right. Commas are fine.">
            <Input id="deal-ticket" inputMode="decimal" value={v.ticket} onChange={(e) => set("ticket", e.target.value)} aria-invalid={!!err("ticket")} className="num" placeholder="18,500,000" />
          </FormField>
          <FormField label="Currency" htmlFor="deal-currency" error={err("currency")}>
            <NativeSelect id="deal-currency" value={v.currency} onChange={(e) => set("currency", e.target.value)}>
              {options.currencies.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          {!editing && (
            <FormField label="Stage" htmlFor="deal-stage">
              <NativeSelect id="deal-stage" value={v.stage} onChange={(e) => set("stage", e.target.value)}>
                {openStages.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
          )}
          <FormField label="Probability (%)" htmlFor="deal-prob" error={err("probability")} hint="Leave blank to use the stage default.">
            <Input id="deal-prob" inputMode="numeric" value={v.probability} onChange={(e) => set("probability", e.target.value.replace(/\D/g, "").slice(0, 3))} className="num" />
          </FormField>
          <FormField label="Expected close" htmlFor="deal-close" error={err("expected_close_date")}>
            <Input id="deal-close" type="date" value={v.expected_close_date} onChange={(e) => set("expected_close_date", e.target.value)} className="num" />
          </FormField>
          <FormField label="Owner" htmlFor="deal-owner">
            <NativeSelect id="deal-owner" value={v.owner_id} onChange={(e) => set("owner_id", e.target.value)}>
              <option value="">Unassigned</option>
              {options.people.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="Project owner" htmlFor="deal-po">
            <NativeSelect id="deal-po" value={v.project_owner_org_id} onChange={(e) => set("project_owner_org_id", e.target.value)}>
              <option value="">Not recorded</option>
              {options.orgs.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="Introduced by" htmlFor="deal-intro">
            <NativeSelect id="deal-intro" value={v.introducer_org_id} onChange={(e) => set("introducer_org_id", e.target.value)}>
              <option value="">Direct / not recorded</option>
              {options.orgs.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="Lantana fee terms" htmlFor="deal-fee" hint="e.g. to be agreed per deal at SPV stage">
            <Input id="deal-fee" value={v.fee_terms} onChange={(e) => set("fee_terms", e.target.value)} />
          </FormField>
          <div className="flex items-end pb-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox checked={v.spv_planned} onCheckedChange={(c) => set("spv_planned", c === true)} /> SPV planned
            </label>
          </div>
          <FormField label="Next step" htmlFor="deal-next" className="sm:col-span-1">
            <Input id="deal-next" value={v.next_step} onChange={(e) => set("next_step", e.target.value)} />
          </FormField>
          <FormField label="Next step due" htmlFor="deal-next-due" error={err("next_step_due")}>
            <Input id="deal-next-due" type="date" value={v.next_step_due} onChange={(e) => set("next_step_due", e.target.value)} className="num" />
          </FormField>
          <FormField label="Summary" htmlFor="deal-summary" className="sm:col-span-2">
            <Textarea id="deal-summary" value={v.summary} onChange={(e) => set("summary", e.target.value)} rows={3} />
          </FormField>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2Icon className="animate-spin" />}
              {editing ? "Save changes" : "Create deal"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
