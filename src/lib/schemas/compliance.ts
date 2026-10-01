import { z } from "zod";
import { optionalDate, optionalText, optionalUuid } from "./common";

export const COMPLIANCE_CATEGORIES = ["licence", "tax", "filing", "lease", "insurance", "visa", "other"] as const;
export const COMPLIANCE_STATUSES = ["unconfirmed", "upcoming", "in_progress", "done", "not_applicable"] as const;
export const RECURRENCES = ["monthly", "quarterly", "yearly"] as const;
export const RECORD_KINDS = ["licence", "registration", "shareholder", "signatory", "lease", "other"] as const;
export const MEETING_KINDS = ["board", "shareholders", "management", "meeting"] as const;
export const RESOLUTION_STATUSES = ["draft", "passed", "rejected", "withdrawn"] as const;

const nullableEnum = <T extends readonly [string, ...string[]]>(values: T) => z.preprocess((v) => (v === "" ? null : v), z.enum(values).nullable().optional());

export const obligationSchema = z
  .object({
    title: z.string().trim().min(3, "Name the obligation").max(300),
    category: z.enum(COMPLIANCE_CATEGORIES),
    authority: optionalText(200),
    due_date: optionalDate,
    recurrence: nullableEnum(RECURRENCES),
    status: z.enum(COMPLIANCE_STATUSES),
    owner_id: optionalUuid,
    document_id: optionalUuid,
    notes: optionalText(4000),
  })
  .refine((o) => !["upcoming", "in_progress"].includes(o.status) || o.due_date, { path: ["due_date"], message: "A confirmed obligation needs a due date" })
  .refine((o) => !o.recurrence || o.due_date, { path: ["recurrence"], message: "Set a due date for it to repeat from" });

export const recordSchema = z
  .object({
    kind: z.enum(RECORD_KINDS),
    title: z.string().trim().min(2, "Name the record").max(300),
    reference_no: optionalText(120),
    authority: optionalText(200),
    holder: optionalText(300),
    detail: optionalText(1000),
    issue_date: optionalDate,
    expiry_date: optionalDate,
    document_id: optionalUuid,
    notes: optionalText(4000),
  })
  .refine((r) => !(r.issue_date && r.expiry_date) || r.expiry_date >= r.issue_date, { path: ["expiry_date"], message: "Expires before it was issued" });

export const meetingSchema = z.object({
  title: z.string().trim().min(3, "Name the meeting").max(300),
  kind: z.enum(MEETING_KINDS),
  starts_at: z.string().min(10, "When is it?"),
  location: optionalText(200),
  attendee_ids: z.array(z.string().uuid()).max(50).default([]),
  notes: optionalText(4000),
  minutes: optionalText(20000),
});

export const resolutionSchema = z
  .object({
    meeting_id: optionalUuid,
    ref_no: optionalText(60),
    title: z.string().trim().min(3, "Name the resolution").max(300),
    body: optionalText(8000),
    kind: z.enum(["board", "shareholders", "manager"]),
    status: z.enum(RESOLUTION_STATUSES),
    passed_on: optionalDate,
    document_id: optionalUuid,
  })
  .refine((r) => r.status !== "passed" || r.passed_on, { path: ["passed_on"], message: "When was it passed?" });


