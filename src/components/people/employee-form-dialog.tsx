"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { FormField } from "@/components/form-field";
import { EMPLOYEE_STATUSES, EMPLOYMENT_TYPES } from "@/lib/people";
import { label } from "@/lib/schemas/common";
import { createEmployeeAction, updateEmployeeAction } from "@/server/actions/people";

type Opt = { value: string; label: string };

export type EmployeeFormValues = {
  full_name: string;
  job_title: string;
  department: string;
  work_email: string;
  phone: string;
  manager_id: string;
  profile_id: string;
  employment_type: string;
  status: string;
  on_payroll: boolean;
  start_date: string;
  end_date: string;
  probation_end: string;
  work_location: string;
  visa_expiry: string;
  emirates_id_expiry: string;
  labour_card_expiry: string;
  passport_expiry: string;
  insurance_expiry: string;
};

const EMPTY: EmployeeFormValues = {
  full_name: "",
  job_title: "",
  department: "",
  work_email: "",
  phone: "",
  manager_id: "",
  profile_id: "",
  employment_type: "full_time",
  status: "onboarding",
  on_payroll: true,
  start_date: "",
  end_date: "",
  probation_end: "",
  work_location: "Ras Al Khaimah",
  visa_expiry: "",
  emirates_id_expiry: "",
  labour_card_expiry: "",
  passport_expiry: "",
  insurance_expiry: "",
};

export function EmployeeFormDialog({
  open,
  onOpenChange,
  employeeId,
  initial,
  options,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  employeeId?: string;
  initial?: Partial<EmployeeFormValues>;
  options: { employees: Opt[]; logins: Opt[] };
}) {
  const router = useRouter();
  const [v, setV] = useState<EmployeeFormValues>({ ...EMPTY, ...initial });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const set = <K extends keyof EmployeeFormValues>(k: K, val: EmployeeFormValues[K]) => setV((s) => ({ ...s, [k]: val }));
  const text = (k: keyof EmployeeFormValues, lbl: string, type = "text", hint?: string) => (
    <FormField label={lbl} htmlFor={`em-${k}`} error={errors[k]} hint={hint}>
      <Input id={`em-${k}`} type={type} value={v[k] as string} onChange={(e) => set(k, e.target.value as never)} aria-invalid={!!errors[k]} />
    </FormField>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => (onOpenChange(o), !o && setErrors({}))}>
      <DialogContent className="top-[4vh] max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogTitle>{employeeId ? "Edit employee" : "New employee"}</DialogTitle>
        <DialogDescription className="mt-1">
          Expiry dates drive alerts at 90, 60, 30 and 7 days. ID numbers, bank details and pay are entered separately by a principal and stored encrypted.
        </DialogDescription>
        <form
          noValidate
          className="mt-5 grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = employeeId ? await updateEmployeeAction(employeeId, v) : await createEmployeeAction(v);
              if (!r.ok) {
                setErrors(r.fieldErrors ?? {});
                return void toast.error(r.error);
              }
              toast.success(employeeId ? "Saved" : "Employee added");
              onOpenChange(false);
              if (!employeeId && r.data && typeof r.data === "object" && "id" in r.data) router.push(`/people/${(r.data as { id: string }).id}`);
              else router.refresh();
            });
          }}
        >
          {text("full_name", "Full name (as on passport)")}
          {text("job_title", "Job title")}
          {text("department", "Department")}
          <FormField label="Reports to" htmlFor="em-manager">
            <NativeSelect id="em-manager" value={v.manager_id} onChange={(e) => set("manager_id", e.target.value)}>
              <option value="">Nobody</option>
              {options.employees
                .filter((o) => o.value !== employeeId)
                .map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
            </NativeSelect>
          </FormField>
          {text("work_email", "Work email", "email")}
          {text("phone", "Phone")}
          <FormField label="Lantana Command login" htmlFor="em-login" error={errors.profile_id} hint="Links the record to a user, so they see their own leave.">
            <NativeSelect id="em-login" value={v.profile_id} onChange={(e) => set("profile_id", e.target.value)}>
              <option value="">No login</option>
              {options.logins.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="Contract" htmlFor="em-type">
            <NativeSelect id="em-type" value={v.employment_type} onChange={(e) => set("employment_type", e.target.value)}>
              {EMPLOYMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {label(t)}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="Status" htmlFor="em-status">
            <NativeSelect id="em-status" value={v.status} onChange={(e) => set("status", e.target.value)}>
              {EMPLOYEE_STATUSES.map((t) => (
                <option key={t} value={t}>
                  {label(t)}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          {text("work_location", "Work location")}
          {text("start_date", "Start date", "date")}
          {text("probation_end", "Probation ends", "date")}
          {text("end_date", "Last working day", "date")}
          <div className="flex items-center gap-2 self-end pb-2">
            <Checkbox id="em-payroll" checked={v.on_payroll} onCheckedChange={(c) => set("on_payroll", c === true)} />
            <Label htmlFor="em-payroll">Paid through payroll</Label>
          </div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase sm:col-span-2">Document expiry dates</p>
          {text("visa_expiry", "Residence visa", "date")}
          {text("emirates_id_expiry", "Emirates ID", "date")}
          {text("labour_card_expiry", "Labour card / work permit", "date")}
          {text("passport_expiry", "Passport", "date")}
          {text("insurance_expiry", "Health insurance", "date")}
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {employeeId ? "Save" : "Add employee"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
