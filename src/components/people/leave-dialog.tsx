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
import { LEAVE_KINDS, workingDays } from "@/lib/people";
import { label } from "@/lib/schemas/common";
import { requestLeaveAction } from "@/server/actions/people";

type Opt = { value: string; label: string };

/** Request leave. Days default to Monday–Friday in the range; public holidays aren't known, so adjust by hand. */
export function LeaveDialog({ open, onOpenChange, employees, fixedEmployee }: { open: boolean; onOpenChange: (o: boolean) => void; employees: Opt[]; fixedEmployee?: string }) {
  const router = useRouter();
  const [v, setV] = useState({ employee_id: fixedEmployee ?? "", kind: "annual", start_date: "", end_date: "", days: "", reason: "" });
  const [daysTouched, setDaysTouched] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const setRange = (k: "start_date" | "end_date", val: string) =>
    setV((s) => {
      const next = { ...s, [k]: val };
      if (k === "start_date" && (!s.end_date || s.end_date < val)) next.end_date = val;
      if (!daysTouched && next.start_date && next.end_date) next.days = String(workingDays(next.start_date, next.end_date));
      return next;
    });

  return (
    <Dialog open={open} onOpenChange={(o) => (onOpenChange(o), !o && setErrors({}))}>
      <DialogContent className="max-w-lg">
        <DialogTitle>Request leave</DialogTitle>
        <DialogDescription className="mt-1">A manager or principal approves it. Days count Monday to Friday; take public holidays off by hand.</DialogDescription>
        <form
          noValidate
          className="mt-4 grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await requestLeaveAction(v);
              if (!r.ok) {
                setErrors(r.fieldErrors ?? {});
                return void toast.error(r.error);
              }
              toast.success("Leave requested");
              setV({ employee_id: fixedEmployee ?? "", kind: "annual", start_date: "", end_date: "", days: "", reason: "" });
              setDaysTouched(false);
              onOpenChange(false);
              router.refresh();
            });
          }}
        >
          {!fixedEmployee && (
            <FormField label="Who" htmlFor="lv-emp" error={errors.employee_id} className="sm:col-span-2">
              <NativeSelect id="lv-emp" value={v.employee_id} onChange={(e) => setV({ ...v, employee_id: e.target.value })}>
                <option value="">Choose…</option>
                {employees.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
          )}
          <FormField label="Type" htmlFor="lv-kind">
            <NativeSelect id="lv-kind" value={v.kind} onChange={(e) => setV({ ...v, kind: e.target.value })}>
              {LEAVE_KINDS.map((k) => (
                <option key={k} value={k}>
                  {label(k)}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="Working days" htmlFor="lv-days" error={errors.days}>
            <Input
              id="lv-days"
              inputMode="decimal"
              value={v.days}
              onChange={(e) => {
                setDaysTouched(true);
                setV({ ...v, days: e.target.value });
              }}
            />
          </FormField>
          <FormField label="From" htmlFor="lv-start" error={errors.start_date}>
            <Input id="lv-start" type="date" value={v.start_date} onChange={(e) => setRange("start_date", e.target.value)} />
          </FormField>
          <FormField label="To" htmlFor="lv-end" error={errors.end_date}>
            <Input id="lv-end" type="date" value={v.end_date} onChange={(e) => setRange("end_date", e.target.value)} />
          </FormField>
          <FormField label="Note" htmlFor="lv-reason" className="sm:col-span-2">
            <Textarea id="lv-reason" rows={2} value={v.reason} onChange={(e) => setV({ ...v, reason: e.target.value })} />
          </FormField>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              Request
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
