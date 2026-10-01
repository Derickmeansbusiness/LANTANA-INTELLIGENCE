"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, EyeIcon, EyeOffIcon, ListChecksIcon, Loader2Icon, PencilIcon, PlusIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { FormField } from "@/components/form-field";
import { fmtDate, todayDubai } from "@/lib/dates";
import { formatMoney, toMajor } from "@/lib/money";
import { gratuity } from "@/lib/people";
import { label } from "@/lib/schemas/common";
import { cn } from "@/lib/utils";
import type { CompRow } from "@/server/people";
import {
  addChecklistItemAction,
  addCompensationAction,
  compensationHistoryAction,
  decideLeaveAction,
  revealIdentityAction,
  setIdentityAction,
  startChecklistAction,
  toggleChecklistItemAction,
} from "@/server/actions/people";
import { EmployeeFormDialog, type EmployeeFormValues } from "./employee-form-dialog";
import { LeaveDialog } from "./leave-dialog";
import { leaveStatusVariant } from "./format";

type Opt = { value: string; label: string };

export function EmployeeActions({
  id,
  canEdit,
  canRequestLeave,
  initial,
  options,
}: {
  id: string;
  canEdit: boolean;
  canRequestLeave: boolean;
  initial: EmployeeFormValues;
  options: { employees: Opt[]; logins: Opt[] };
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<"edit" | "leave" | null>(null);
  const [pending, start] = useTransition();
  return (
    <>
      {canRequestLeave && (
        <Button variant="outline" size="sm" onClick={() => setDialog("leave")}>
          <PlusIcon /> Request leave
        </Button>
      )}
      {canEdit && (
        <>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={pending}>
                {pending ? <Loader2Icon className="animate-spin" /> : <ListChecksIcon />} Checklist
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {(["onboarding", "offboarding"] as const).map((k) => (
                <DropdownMenuItem
                  key={k}
                  onSelect={() =>
                    start(async () => {
                      const r = await startChecklistAction(id, k);
                      if (!r.ok) return void toast.error(r.error);
                      toast.success(`${label(k)} checklist started`);
                      router.refresh();
                    })
                  }
                >
                  Start {k} checklist
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" onClick={() => setDialog("edit")}>
            <PencilIcon /> Edit
          </Button>
          <EmployeeFormDialog open={dialog === "edit"} onOpenChange={(o) => setDialog(o ? "edit" : null)} employeeId={id} initial={initial} options={options} />
        </>
      )}
      <LeaveDialog open={dialog === "leave"} onOpenChange={(o) => setDialog(o ? "leave" : null)} employees={[]} fixedEmployee={id} />
    </>
  );
}

export type LeaveItem = { id: string; kind: string; start_date: string; end_date: string; days: number; reason: string | null; status: string; decision_note: string | null; decider: { full_name: string } | null };

export function LeaveList({ items, canDecide, canCancelOwn }: { items: LeaveItem[]; canDecide: boolean; canCancelOwn: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const decide = (id: string, d: "approved" | "rejected" | "cancelled") =>
    start(async () => {
      const r = await decideLeaveAction(id, d);
      if (!r.ok) return void toast.error(r.error);
      toast.success(d === "approved" ? "Approved" : d === "rejected" ? "Rejected" : "Cancelled");
      router.refresh();
    });
  if (!items.length) return <p className="text-sm text-muted-foreground">No leave recorded.</p>;
  return (
    <ul className="divide-y">
      {items.map((l) => (
        <li key={l.id} className="flex flex-wrap items-start justify-between gap-2 py-2.5 text-sm">
          <div className="min-w-0">
            <p>
              <span className="font-medium">{label(l.kind)}</span> · <span className="num">{Number(l.days)} d</span>
            </p>
            <p className="num text-xs text-muted-foreground">
              {fmtDate(l.start_date)} – {fmtDate(l.end_date)}
              {l.reason && <span className="font-sans"> · {l.reason}</span>}
            </p>
            {l.decider && l.status !== "pending" && (
              <p className="text-xs text-muted-foreground">
                {label(l.status)} by {l.decider.full_name}
                {l.decision_note ? ` · ${l.decision_note}` : ""}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Badge variant={leaveStatusVariant(l.status)}>{label(l.status)}</Badge>
            {l.status === "pending" && canDecide && (
              <>
                <Button variant="ghost" size="sm" aria-label="Approve" disabled={pending} onClick={() => decide(l.id, "approved")}>
                  <CheckIcon />
                </Button>
                <Button variant="ghost" size="sm" aria-label="Reject" disabled={pending} onClick={() => decide(l.id, "rejected")}>
                  <XIcon />
                </Button>
              </>
            )}
            {((l.status === "pending" && canCancelOwn) || (l.status === "approved" && canDecide && l.start_date > todayDubai())) && (
              <Button variant="ghost" size="sm" disabled={pending} onClick={() => decide(l.id, "cancelled")}>
                Cancel
              </Button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

export type ChecklistView = {
  id: string;
  kind: string;
  title: string;
  items: { id: string; title: string; due_date: string | null; done_at: string | null; owner_id: string | null; owner: { full_name: string } | null; doner: { full_name: string } | null }[];
};

export function ChecklistPanel({ list, me, canManage, people }: { list: ChecklistView; me: string; canManage: boolean; people: Opt[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [v, setV] = useState({ title: "", due: "", owner: "" });
  const today = todayDubai();
  const done = list.items.filter((i) => i.done_at).length;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{list.title}</p>
        <span className="num text-xs text-muted-foreground">
          {done}/{list.items.length}
        </span>
      </div>
      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
        <div className="h-full rounded-full bg-gold" style={{ width: `${list.items.length ? (done / list.items.length) * 100 : 0}%` }} />
      </div>
      <ul className="space-y-1.5">
        {list.items.map((i) => {
          const mine = i.owner_id === me;
          const overdue = !i.done_at && i.due_date && i.due_date < today;
          return (
            <li key={i.id} className="flex items-start gap-2 text-sm">
              <Checkbox
                id={`ci-${i.id}`}
                checked={Boolean(i.done_at)}
                disabled={pending || !(canManage || mine)}
                className="mt-0.5"
                onCheckedChange={(c) =>
                  start(async () => {
                    const r = await toggleChecklistItemAction(i.id, c === true);
                    if (!r.ok) return void toast.error(r.error);
                    router.refresh();
                  })
                }
              />
              <label htmlFor={`ci-${i.id}`} className="min-w-0 flex-1">
                <span className={cn(i.done_at && "text-muted-foreground line-through")}>{i.title}</span>
                <span className="block text-xs text-muted-foreground">
                  {i.due_date && <span className={cn("num", overdue && "text-danger")}>Due {fmtDate(i.due_date)}</span>}
                  {i.owner && ` · ${i.owner.full_name}`}
                  {i.done_at && i.doner && ` · done by ${i.doner.full_name}`}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      {canManage && (
        <form
          noValidate
          className="mt-3 flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await addChecklistItemAction(list.id, v.title, v.due || null, v.owner || null);
              if (!r.ok) return void toast.error(r.error);
              setV({ title: "", due: "", owner: "" });
              router.refresh();
            });
          }}
        >
          <Input aria-label="New step" placeholder="Add a step…" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} className="h-8 min-w-40 flex-1" />
          <Input aria-label="Due date" type="date" value={v.due} onChange={(e) => setV({ ...v, due: e.target.value })} className="h-8 w-36" />
          <NativeSelect aria-label="Owner" value={v.owner} onChange={(e) => setV({ ...v, owner: e.target.value })} className="h-8 w-40">
            <option value="">No owner</option>
            {people.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </NativeSelect>
          <Button type="submit" variant="outline" size="sm" disabled={pending || v.title.trim().length < 2}>
            Add
          </Button>
        </form>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- identity (principal)

export type IdentityMasked = {
  nationality: string | null;
  date_of_birth: string | null;
  passport_last4: string | null;
  emirates_id_last4: string | null;
  iban_last4: string | null;
  bank_name: string | null;
  bank_routing_code: string | null;
  has_visa: boolean;
  has_labour: boolean;
  has_mohre: boolean;
};

export function IdentityPanel({ employeeId, identity, countries }: { employeeId: string; identity: IdentityMasked | null; countries: Opt[] }) {
  const router = useRouter();
  const [revealed, setRevealed] = useState<Record<string, string | null> | null>(null);
  const [edit, setEdit] = useState(false);
  const [pending, start] = useTransition();
  const mask = (last4: string | null | undefined, has = Boolean(last4)) => (has ? (last4 ? `•••• ${last4}` : "Recorded") : "—");
  const rows: [string, string, string][] = [
    ["Nationality", countries.find((c) => c.value === identity?.nationality)?.label ?? identity?.nationality ?? "—", ""],
    ["Date of birth", identity?.date_of_birth ? fmtDate(identity.date_of_birth) : "—", ""],
    ["Passport no.", mask(identity?.passport_last4), "passport_no"],
    ["Emirates ID", mask(identity?.emirates_id_last4), "emirates_id_no"],
    ["Visa file no.", mask(null, identity?.has_visa), "visa_file_no"],
    ["Labour card no.", mask(null, identity?.has_labour), "labour_card_no"],
    ["MOHRE person code", mask(null, identity?.has_mohre), "mohre_person_code"],
    ["Salary IBAN", mask(identity?.iban_last4), "iban"],
    ["Bank", [identity?.bank_name, identity?.bank_routing_code && `routing ${identity.bank_routing_code}`].filter(Boolean).join(" · ") || "—", ""],
  ];
  return (
    <div>
      <dl className="grid grid-cols-[8.5rem_1fr] gap-x-3 gap-y-1.5 text-sm">
        {rows.map(([k, v, key]) => (
          <div key={k} className="contents">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="num min-w-0 break-all">{revealed && key ? (revealed[key] ?? "—") : v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() =>
            revealed
              ? setRevealed(null)
              : start(async () => {
                  const r = await revealIdentityAction(employeeId);
                  if (!r.ok) return void toast.error(r.error);
                  setRevealed(r.data);
                })
          }
        >
          {revealed ? <EyeOffIcon /> : <EyeIcon />} {revealed ? "Hide numbers" : "Reveal numbers"}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setEdit(true)}>
          <PencilIcon /> Update
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Encrypted at rest. Revealing is logged in the audit trail.</p>
      {edit && (
        <IdentityDialog
          employeeId={employeeId}
          countries={countries}
          initial={{ nationality: identity?.nationality ?? "", date_of_birth: identity?.date_of_birth ?? "", bank_name: identity?.bank_name ?? "", bank_routing_code: identity?.bank_routing_code ?? "" }}
          onClose={() => {
            setEdit(false);
            setRevealed(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function IdentityDialog({ employeeId, countries, initial, onClose }: { employeeId: string; countries: Opt[]; initial: Record<string, string>; onClose: () => void }) {
  const [v, setV] = useState<Record<string, string>>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const secret = (k: string, lbl: string, hint?: string) => (
    <FormField label={lbl} htmlFor={`id-${k}`} error={errors[k]} hint={hint}>
      <Input id={`id-${k}`} autoComplete="off" value={v[k] ?? ""} placeholder="Unchanged" onChange={(e) => setV({ ...v, [k]: e.target.value })} />
    </FormField>
  );
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="top-[5vh] max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogTitle>Identity and bank details</DialogTitle>
        <DialogDescription className="mt-1">Leave a number blank to keep what’s stored. Numbers are encrypted before they’re saved.</DialogDescription>
        <form
          noValidate
          className="mt-4 grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            // Blank secret fields mean "unchanged": don't send them.
            const payload = Object.fromEntries(
              Object.entries(v).filter(([k, val]) => ["nationality", "date_of_birth", "bank_name", "bank_routing_code"].includes(k) || val.trim() !== ""),
            );
            start(async () => {
              const r = await setIdentityAction(employeeId, payload);
              if (!r.ok) {
                setErrors(r.fieldErrors ?? {});
                return void toast.error(r.error);
              }
              toast.success("Saved");
              onClose();
            });
          }}
        >
          <FormField label="Nationality" htmlFor="id-nat">
            <NativeSelect id="id-nat" value={v.nationality ?? ""} onChange={(e) => setV({ ...v, nationality: e.target.value })}>
              <option value="">Not recorded</option>
              {countries.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="Date of birth" htmlFor="id-dob">
            <Input id="id-dob" type="date" value={v.date_of_birth ?? ""} onChange={(e) => setV({ ...v, date_of_birth: e.target.value })} />
          </FormField>
          {secret("passport_no", "Passport no.")}
          {secret("emirates_id_no", "Emirates ID", "784-XXXX-XXXXXXX-X")}
          {secret("visa_file_no", "Visa file no.")}
          {secret("labour_card_no", "Labour card no.")}
          {secret("mohre_person_code", "MOHRE person code", "14 digits, used for WPS")}
          {secret("iban", "Salary IBAN", "AE + 21 digits")}
          <FormField label="Bank name" htmlFor="id-bank">
            <Input id="id-bank" value={v.bank_name ?? ""} onChange={(e) => setV({ ...v, bank_name: e.target.value })} />
          </FormField>
          <FormField label="Bank routing (agent) code" htmlFor="id-route" hint="9 digits, used for WPS">
            <Input id="id-route" value={v.bank_routing_code ?? ""} onChange={(e) => setV({ ...v, bank_routing_code: e.target.value })} />
          </FormField>
          <div className="flex justify-end gap-2 sm:col-span-2">
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

// ---------------------------------------------------------------- pay (principal)

export function PayPanel({ employeeId, startDate, endDate, currencies }: { employeeId: string; startDate: string | null; endDate: string | null; currencies: Opt[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<CompRow[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [pending, start] = useTransition();
  const load = () =>
    start(async () => {
      const r = await compensationHistoryAction(employeeId);
      if (!r.ok) return void toast.error(r.error);
      setRows(r.data);
    });
  const m = (minor: number, c: string) => formatMoney(toMajor(minor, c), c);
  const current = rows?.find((r) => r.effective_from <= todayDubai()) ?? rows?.[0];
  const g = current && startDate ? gratuity(current.basic_minor, startDate, endDate ?? todayDubai()) : null;

  if (!rows)
    return (
      <div>
        <p className="text-sm text-muted-foreground">Pay is hidden until you ask for it. Showing it is logged.</p>
        <Button variant="outline" size="sm" className="mt-3" disabled={pending} onClick={load}>
          {pending ? <Loader2Icon className="animate-spin" /> : <EyeIcon />} Show pay
        </Button>
      </div>
    );

  return (
    <div className="space-y-4">
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No salary on record.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[460px] text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th scope="col" className="py-1.5 text-left font-normal">From</th>
                <th scope="col" className="py-1.5 text-right font-normal">Basic</th>
                <th scope="col" className="py-1.5 text-right font-normal">Housing</th>
                <th scope="col" className="py-1.5 text-right font-normal">Transport</th>
                <th scope="col" className="py-1.5 text-right font-normal">Other</th>
                <th scope="col" className="py-1.5 text-right font-normal">Monthly</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={cn("border-b last:border-0", r !== current && "text-muted-foreground")}>
                  <td className="num py-1.5">{fmtDate(r.effective_from)}</td>
                  <td className="num py-1.5 text-right">{m(r.basic_minor, r.currency)}</td>
                  <td className="num py-1.5 text-right">{r.housing_minor ? m(r.housing_minor, r.currency) : "—"}</td>
                  <td className="num py-1.5 text-right">{r.transport_minor ? m(r.transport_minor, r.currency) : "—"}</td>
                  <td className="num py-1.5 text-right">{r.other_minor ? m(r.other_minor, r.currency) : "—"}</td>
                  <td className="num py-1.5 text-right font-medium">{m(r.total_minor, r.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {g && current && (
        <p className="rounded-md bg-surface-2 p-3 text-sm">
          <span className="font-medium">End-of-service gratuity to date: </span>
          {g.eligible ? (
            <span className="num">{m(g.minor, current.currency)}</span>
          ) : (
            <span>none yet (under one year of service)</span>
          )}
          <span className="block text-xs text-muted-foreground">
            Estimate on the current basic salary, <span className="num">{g.years.toFixed(1)}</span> years of service: 21 days a year for five years, 30 after, capped at two years’ pay. Confirm with your adviser before a final settlement.
          </span>
        </p>
      )}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
          <PlusIcon /> Pay change
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setRows(null)}>
          <EyeOffIcon /> Hide
        </Button>
      </div>
      {adding && (
        <CompDialog
          employeeId={employeeId}
          currencies={currencies}
          onClose={(saved) => {
            setAdding(false);
            if (saved) {
              load();
              router.refresh();
            }
          }}
        />
      )}
    </div>
  );
}

function CompDialog({ employeeId, currencies, onClose }: { employeeId: string; currencies: Opt[]; onClose: (saved: boolean) => void }) {
  const [v, setV] = useState({ effective_from: todayDubai(), currency: "AED", basic: "", housing: "", transport: "", other: "", note: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const money = (k: "basic" | "housing" | "transport" | "other", lbl: string) => (
    <FormField label={lbl} htmlFor={`cp-${k}`} error={errors[k]}>
      <Input id={`cp-${k}`} inputMode="decimal" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} />
    </FormField>
  );
  return (
    <Dialog open onOpenChange={(o) => !o && onClose(false)}>
      <DialogContent className="max-w-lg">
        <DialogTitle>Pay change</DialogTitle>
        <DialogDescription className="mt-1">Monthly amounts from the date it takes effect. Earlier records stay as history.</DialogDescription>
        <form
          noValidate
          className="mt-4 grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await addCompensationAction(employeeId, v);
              if (!r.ok) {
                setErrors(r.fieldErrors ?? {});
                return void toast.error(r.error);
              }
              toast.success("Pay recorded");
              onClose(true);
            });
          }}
        >
          <FormField label="Effective from" htmlFor="cp-from" error={errors.effective_from}>
            <Input id="cp-from" type="date" value={v.effective_from} onChange={(e) => setV({ ...v, effective_from: e.target.value })} />
          </FormField>
          <FormField label="Currency" htmlFor="cp-cur" hint="Payroll and WPS run in AED.">
            <NativeSelect id="cp-cur" value={v.currency} onChange={(e) => setV({ ...v, currency: e.target.value })}>
              {currencies.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          {money("basic", "Basic salary")}
          {money("housing", "Housing allowance")}
          {money("transport", "Transport allowance")}
          {money("other", "Other allowances")}
          <FormField label="Note" htmlFor="cp-note" className="sm:col-span-2">
            <Input id="cp-note" value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} placeholder="e.g. Annual review" />
          </FormField>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="ghost" onClick={() => onClose(false)}>
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
