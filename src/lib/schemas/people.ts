import { z } from "zod";
import { isoDate, optionalDate, optionalText, optionalUuid } from "./common";
import { EMPLOYEE_STATUSES, EMPLOYMENT_TYPES, LEAVE_KINDS } from "@/lib/people";

export const employeeSchema = z
  .object({
    full_name: z.string().trim().min(2, "Enter the person's name").max(200),
    job_title: optionalText(200),
    department: optionalText(100),
    work_email: z.preprocess((v) => (v === "" ? null : v), z.string().trim().email("Use a valid email").max(200).nullable().optional()),
    phone: optionalText(40),
    manager_id: optionalUuid,
    profile_id: optionalUuid,
    employment_type: z.enum(EMPLOYMENT_TYPES),
    status: z.enum(EMPLOYEE_STATUSES),
    on_payroll: z.boolean().default(true),
    start_date: optionalDate,
    end_date: optionalDate,
    probation_end: optionalDate,
    work_location: optionalText(120),
    visa_expiry: optionalDate,
    emirates_id_expiry: optionalDate,
    labour_card_expiry: optionalDate,
    passport_expiry: optionalDate,
    insurance_expiry: optionalDate,
  })
  .refine((e) => !(e.start_date && e.end_date) || e.end_date >= e.start_date, { path: ["end_date"], message: "Ends before it starts" })
  .refine((e) => e.status !== "left" || e.end_date, { path: ["end_date"], message: "Set the last working day" });

/** Keys sent to set_employee_identity. Empty string clears; absent leaves unchanged. */
export const identitySchema = z.object({
  nationality: z.string().trim().max(2).optional(),
  date_of_birth: z.string().optional(),
  passport_no: z.string().trim().max(20).optional(),
  emirates_id_no: z.string().trim().max(20).optional(),
  visa_file_no: z.string().trim().max(40).optional(),
  labour_card_no: z.string().trim().max(40).optional(),
  mohre_person_code: z.string().trim().max(20).optional(),
  iban: z.string().trim().max(40).optional(),
  bank_name: z.string().trim().max(100).optional(),
  bank_routing_code: z.string().trim().max(12).optional(),
});

const amount = z.preprocess(
  (v) => {
    if (v === "" || v == null) return 0;
    const n = Number(String(v).replace(/[,\s]/g, ""));
    return Number.isFinite(n) ? n : v;
  },
  z.number({ error: "Enter an amount" }).min(0, "Can't be negative").max(1e8, "Too large"),
);

export const compensationSchema = z.object({
  effective_from: isoDate,
  currency: z.string().regex(/^[A-Z]{3}$/),
  basic: amount.refine((n) => n > 0, "Basic salary is required"),
  housing: amount,
  transport: amount,
  other: amount,
  note: optionalText(500),
});

export const leaveRequestSchema = z
  .object({
    employee_id: z.string().uuid("Choose who is taking leave"),
    kind: z.enum(LEAVE_KINDS),
    start_date: isoDate,
    end_date: isoDate,
    days: z.coerce.number({ error: "How many days?" }).positive("More than zero").max(365),
    reason: optionalText(500),
  })
  .refine((l) => l.end_date >= l.start_date, { path: ["end_date"], message: "Ends before it starts" });

export const leaveBalanceSchema = z.object({
  employee_id: z.string().uuid(),
  year: z.coerce.number().int().min(2000).max(2100),
  kind: z.enum(LEAVE_KINDS),
  entitled_days: z.coerce.number().min(0).max(365),
  carried_over: z.coerce.number().min(0).max(365).default(0),
});

export const payrollItemSchema = z.object({
  variable: amount,
  deductions: amount,
  note: optionalText(300),
});

export const wpsSettingsSchema = z.object({
  mohre_establishment_id: z.preprocess((v) => (v === "" ? null : v), z.string().regex(/^\d{13}$/, "13 digits").nullable()),
  wps_employer_bank_code: z.preprocess((v) => (v === "" ? null : v), z.string().regex(/^\d{9}$/, "9 digits").nullable()),
});
