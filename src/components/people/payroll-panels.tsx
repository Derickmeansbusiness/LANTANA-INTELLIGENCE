"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BanIcon, CheckCircle2Icon, DownloadIcon, Loader2Icon, PencilIcon, PlusIcon, RotateCcwIcon, ShieldCheckIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { FormField } from "@/components/form-field";
import { todayDubai } from "@/lib/dates";
import { formatMoney, toMajor } from "@/lib/money";
import type { PayrollLine } from "@/server/people";
import { createPayrollRunAction, setPayrollStatusAction, setPayrollWpsAction, setWpsSettingsAction, updatePayrollLineAction } from "@/server/actions/people";

type Opt = { value: string; label: string };

export function NewRunButton({ suggested }: { suggested: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(suggested);
  const [pending, start] = useTransition();
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <PlusIcon /> New payroll run
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogTitle>New payroll run</DialogTitle>
          <DialogDescription className="mt-1">Everyone on payroll that month, at the salary in force on its last day, pro rata for joiners and leavers.</DialogDescription>
          <form
            noValidate
            className="mt-4 grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const r = await createPayrollRunAction(month);
                if (!r.ok) return void toast.error(r.error);
                const skipped = r.data.skipped.length ? ` Left out (no salary on record): ${r.data.skipped.join(", ")}.` : "";
                toast.success(`Draft run created for ${r.data.employees} ${r.data.employees === 1 ? "person" : "people"}.${skipped}`, { duration: skipped ? 10000 : 4000 });
                setOpen(false);
                router.push(`/people/payroll/${r.data.id}`);
              });
            }}
          >
            <FormField label="Month" htmlFor="run-month">
              <Input id="run-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
            </FormField>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2Icon className="animate-spin" />} Create draft
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function WpsSettingsForm({ initial }: { initial: { mohre_establishment_id: string; wps_employer_bank_code: string } }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  return (
    <form
      noValidate
      className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await setWpsSettingsAction(v);
          if (!r.ok) {
            setErrors(r.fieldErrors ?? {});
            return void toast.error(r.error);
          }
          setErrors({});
          toast.success("WPS details saved");
          router.refresh();
        });
      }}
    >
      <FormField label="MOHRE establishment ID" htmlFor="wps-emp" error={errors.mohre_establishment_id} hint="13 digits">
        <Input id="wps-emp" inputMode="numeric" value={v.mohre_establishment_id} onChange={(e) => setV({ ...v, mohre_establishment_id: e.target.value.trim() })} />
      </FormField>
      <FormField label="Employer bank routing code" htmlFor="wps-bank" error={errors.wps_employer_bank_code} hint="9 digits">
        <Input id="wps-bank" inputMode="numeric" value={v.wps_employer_bank_code} onChange={(e) => setV({ ...v, wps_employer_bank_code: e.target.value.trim() })} />
      </FormField>
      <Button type="submit" variant="outline" disabled={pending}>
        Save
      </Button>
    </form>
  );
}

export function RunActions({
  runId,
  status,
  wpsStatus,
  wpsReference,
  options,
}: {
  runId: string;
  status: string;
  wpsStatus: string;
  wpsReference: string | null;
  options: { banks: Opt[]; salaryAccounts: Opt[]; payDate: string };
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<"pay" | "wps" | null>(null);
  const [pending, start] = useTransition();
  const set = (s: "approved" | "draft" | "void", msg: string) =>
    start(async () => {
      const r = await setPayrollStatusAction(runId, s);
      if (!r.ok) return void toast.error(r.error);
      toast.success(msg);
      router.refresh();
    });
  return (
    <>
      {status === "draft" && (
        <Button size="sm" disabled={pending} onClick={() => set("approved", "Approved. Amounts are locked.")}>
          <CheckCircle2Icon /> Approve
        </Button>
      )}
      {status === "approved" && (
        <>
          <Button variant="outline" size="sm" disabled={pending} onClick={() => set("draft", "Reopened as a draft")}>
            <RotateCcwIcon /> Reopen
          </Button>
          <Button size="sm" onClick={() => setDialog("pay")}>
            <CheckCircle2Icon /> Mark paid
          </Button>
        </>
      )}
      {status !== "void" && (
        <Button variant="outline" size="sm" asChild>
          <a href={`/people/payroll/${runId}/sif`}>
            <DownloadIcon /> WPS file
          </a>
        </Button>
      )}
      {status !== "void" && (
        <Button variant="outline" size="sm" onClick={() => setDialog("wps")}>
          <ShieldCheckIcon /> WPS status
        </Button>
      )}
      {(status === "draft" || status === "approved") && (
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => {
            if (confirm("Void this payroll run? It stays on record, marked void, and you can start the month again.")) set("void", "Run voided");
          }}
        >
          <BanIcon /> Void
        </Button>
      )}
      {dialog === "pay" && <PayDialog runId={runId} options={options} onClose={() => setDialog(null)} />}
      {dialog === "wps" && <WpsDialog runId={runId} initial={{ status: wpsStatus, reference: wpsReference ?? "" }} onClose={() => setDialog(null)} />}
    </>
  );
}

function PayDialog({ runId, options, onClose }: { runId: string; options: { banks: Opt[]; salaryAccounts: Opt[]; payDate: string }; onClose: () => void }) {
  const router = useRouter();
  const [v, setV] = useState({ paid_on: options.payDate || todayDubai(), bank_account_id: options.banks[0]?.value ?? "", account_id: options.salaryAccounts[0]?.value ?? "" });
  const [pending, start] = useTransition();
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogTitle>Mark paid</DialogTitle>
        <DialogDescription className="mt-1">Records one payroll line in the ledger (visible to principals only) for the run’s net total.</DialogDescription>
        <form
          noValidate
          className="mt-4 grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await setPayrollStatusAction(runId, "paid", v);
              if (!r.ok) return void toast.error(r.error);
              toast.success("Payroll marked paid");
              onClose();
              router.refresh();
            });
          }}
        >
          <FormField label="Paid on" htmlFor="pr-date">
            <Input id="pr-date" type="date" value={v.paid_on} onChange={(e) => setV({ ...v, paid_on: e.target.value })} />
          </FormField>
          <FormField label="From bank account" htmlFor="pr-bank">
            <NativeSelect id="pr-bank" value={v.bank_account_id} onChange={(e) => setV({ ...v, bank_account_id: e.target.value })}>
              {options.banks.length === 0 && <option value="">No bank account recorded</option>}
              {options.banks.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="Ledger account" htmlFor="pr-acc">
            <NativeSelect id="pr-acc" value={v.account_id} onChange={(e) => setV({ ...v, account_id: e.target.value })}>
              {options.salaryAccounts.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !v.bank_account_id || !v.account_id}>
              Mark paid
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function WpsDialog({ runId, initial, onClose }: { runId: string; initial: { status: string; reference: string }; onClose: () => void }) {
  const router = useRouter();
  const [v, setV] = useState({ ...initial, note: "" });
  const [pending, start] = useTransition();
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogTitle>WPS status</DialogTitle>
        <DialogDescription className="mt-1">Record what your bank or exchange house reports for this salary file.</DialogDescription>
        <form
          noValidate
          className="mt-4 grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await setPayrollWpsAction(runId, v.status, v.reference, v.note);
              if (!r.ok) return void toast.error(r.error);
              toast.success("WPS status saved");
              onClose();
              router.refresh();
            });
          }}
        >
          <FormField label="Status" htmlFor="wps-st">
            <NativeSelect id="wps-st" value={v.status} onChange={(e) => setV({ ...v, status: e.target.value })}>
              <option value="not_submitted">Not submitted</option>
              <option value="submitted">Submitted</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
              <option value="not_required">Not required</option>
            </NativeSelect>
          </FormField>
          <FormField label="Reference" htmlFor="wps-ref">
            <Input id="wps-ref" value={v.reference} onChange={(e) => setV({ ...v, reference: e.target.value })} />
          </FormField>
          <FormField label="Note" htmlFor="wps-note">
            <Input id="wps-note" value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} placeholder="e.g. rejection reason" />
          </FormField>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function PayrollLines({ lines, currency, editable }: { lines: PayrollLine[]; currency: string; editable: boolean }) {
  const [editing, setEditing] = useState<PayrollLine | null>(null);
  const m = (minor: number) => formatMoney(toMajor(minor, currency), currency).replace(`${currency} `, "");
  const total = (k: keyof PayrollLine) => lines.reduce((s, l) => s + Number(l[k]), 0);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <caption className="sr-only">Payroll lines in {currency}</caption>
        <thead>
          <tr className="border-b text-xs text-muted-foreground">
            <th scope="col" className="py-2 text-left font-normal">Employee</th>
            <th scope="col" className="py-2 text-right font-normal">Days</th>
            <th scope="col" className="py-2 text-right font-normal">Basic</th>
            <th scope="col" className="py-2 text-right font-normal">Allowances</th>
            <th scope="col" className="py-2 text-right font-normal">Variable</th>
            <th scope="col" className="py-2 text-right font-normal">Deductions</th>
            <th scope="col" className="py-2 text-right font-normal">Net ({currency})</th>
            {editable && <th className="w-10" />}
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.item_id} className="border-b">
              <td className="py-2">
                {l.full_name}
                {l.note && <span className="block text-xs text-muted-foreground">{l.note}</span>}
              </td>
              <td className="num py-2 text-right">
                {l.days_paid}/{l.days_in_period}
              </td>
              <td className="num py-2 text-right">{m(l.basic_minor)}</td>
              <td className="num py-2 text-right">{m(l.allowances_minor)}</td>
              <td className="num py-2 text-right">{l.variable_minor ? m(l.variable_minor) : "—"}</td>
              <td className="num py-2 text-right">{l.deductions_minor ? `−${m(l.deductions_minor)}` : "—"}</td>
              <td className="num py-2 text-right font-medium">{m(l.net_minor)}</td>
              {editable && (
                <td className="py-2 text-right">
                  <Button variant="ghost" size="sm" aria-label={`Adjust ${l.full_name}`} onClick={() => setEditing(l)}>
                    <PencilIcon />
                  </Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-medium">
            <td className="pt-2">Total</td>
            <td />
            <td className="num pt-2 text-right">{m(total("basic_minor"))}</td>
            <td className="num pt-2 text-right">{m(total("allowances_minor"))}</td>
            <td className="num pt-2 text-right">{total("variable_minor") ? m(total("variable_minor")) : "—"}</td>
            <td className="num pt-2 text-right">{total("deductions_minor") ? `−${m(total("deductions_minor"))}` : "—"}</td>
            <td className="num pt-2 text-right">{m(total("net_minor"))}</td>
            {editable && <td />}
          </tr>
        </tfoot>
      </table>
      {editing && <LineDialog line={editing} currency={currency} onClose={() => setEditing(null)} />}
    </div>
  );
}

function LineDialog({ line, currency, onClose }: { line: PayrollLine; currency: string; onClose: () => void }) {
  const router = useRouter();
  const [v, setV] = useState({ variable: String(toMajor(line.variable_minor, currency) || ""), deductions: String(toMajor(line.deductions_minor, currency) || ""), note: line.note ?? "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogTitle>Adjust {line.full_name}</DialogTitle>
        <DialogDescription className="mt-1">Basic and allowances come from the salary record. Add a bonus or overtime, or a deduction, for this month only.</DialogDescription>
        <form
          noValidate
          className="mt-4 grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await updatePayrollLineAction(line.item_id, currency, v);
              if (!r.ok) {
                setErrors(r.fieldErrors ?? {});
                return void toast.error(r.error);
              }
              onClose();
              router.refresh();
            });
          }}
        >
          <FormField label={`Variable pay (${currency})`} htmlFor="pl-var" error={errors.variable} hint="Bonus, overtime, commission">
            <Input id="pl-var" inputMode="decimal" value={v.variable} onChange={(e) => setV({ ...v, variable: e.target.value })} />
          </FormField>
          <FormField label={`Deductions (${currency})`} htmlFor="pl-ded" error={errors.deductions} hint="Salary advance, unpaid leave">
            <Input id="pl-ded" inputMode="decimal" value={v.deductions} onChange={(e) => setV({ ...v, deductions: e.target.value })} />
          </FormField>
          <FormField label="Note" htmlFor="pl-note">
            <Input id="pl-note" value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} />
          </FormField>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
