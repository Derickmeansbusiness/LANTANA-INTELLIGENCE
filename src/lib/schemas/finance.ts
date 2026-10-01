import { z } from "zod";
import { isoDate, optionalText, optionalUuid } from "./common";

export const ACCOUNT_TYPES = ["income", "expense", "asset", "liability", "equity"] as const;
export const INVOICE_KINDS = ["success_fee", "retainer", "advisory", "other"] as const;
export const INVOICE_STATUSES = ["draft", "sent", "paid", "void"] as const;
export const BILL_STATUSES = ["open", "paid", "void"] as const;
export const CATEGORY_SOURCES = ["manual", "rule", "history", "agent"] as const;

const currency = z.string().regex(/^[A-Z]{3}$/, "Choose a currency");

/** Money typed in major units; commas allowed; sign allowed when `signed`. */
const money = (opts: { signed?: boolean; positive?: boolean } = {}) =>
  z.preprocess(
    (v) => {
      if (v === "" || v === null || v === undefined) return undefined;
      const n = Number(String(v).replace(/[,\s]/g, ""));
      return Number.isFinite(n) ? n : v;
    },
    z
      .number({ error: "Enter an amount" })
      .refine((n) => opts.signed || n >= 0, "Must be zero or more")
      .refine((n) => !opts.positive || n > 0, "Must be more than zero")
      .refine((n) => n !== 0 || !opts.signed, "Can't be zero")
      .refine((n) => Math.abs(n) < 1e13, "Too large"),
  );

export const accountSchema = z.object({
  code: z.string().trim().regex(/^\d{3,6}$/, "Use a 3–6 digit code"),
  name: z.string().trim().min(2, "Name the account").max(120),
  type: z.enum(ACCOUNT_TYPES),
});

export const transactionSchema = z.object({
  txn_date: isoDate,
  description: z.string().trim().min(2, "Describe the transaction").max(300),
  amount: money({ signed: true }),
  direction: z.enum(["in", "out"]),
  currency,
  account_id: optionalUuid,
  bank_account_id: optionalUuid,
  counterparty_org_id: optionalUuid,
  deal_id: optionalUuid,
  reference: optionalText(120),
  notes: optionalText(2000),
  is_transfer: z.boolean().default(false),
});

export const transactionPatchSchema = z.object({
  account_id: optionalUuid,
  description: z.string().trim().min(2).max(300).optional(),
  counterparty_org_id: optionalUuid,
  deal_id: optionalUuid,
  notes: optionalText(2000),
  is_transfer: z.boolean().optional(),
});

export const importLineSchema = z.object({
  date: isoDate,
  description: z.string().trim().min(1).max(300),
  amount: z.number().refine((n) => n !== 0 && Math.abs(n) < 1e13),
  reference: z.string().max(120).nullable(),
  account_id: z.string().uuid().nullable(),
  source: z.enum(CATEGORY_SOURCES),
  key: z.string().min(10).max(600),
});

export const importSchema = z.object({
  file_name: z.string().trim().min(1).max(200),
  bank_account_id: optionalUuid,
  currency,
  lines: z.array(importLineSchema).min(1, "Nothing to import").max(2000, "Import at most 2,000 lines at a time"),
});

export const ruleSchema = z.object({
  pattern: z.string().trim().min(2, "At least two characters").max(80),
  account_id: z.string().uuid("Choose an account"),
});

export const invoiceSchema = z
  .object({
    organization_id: z.string().uuid("Choose who you're billing"),
    deal_id: optionalUuid,
    kind: z.enum(INVOICE_KINDS),
    issue_date: isoDate,
    due_date: isoDate,
    currency,
    vat_rate: z.coerce.number().min(0, "0–100").max(100, "0–100"),
    reference: optionalText(120),
    notes: optionalText(2000),
  })
  .refine((i) => i.due_date >= i.issue_date, { path: ["due_date"], message: "Due before it's issued" });

export const invoiceItemSchema = z.object({
  description: z.string().trim().min(2, "Describe the line").max(300),
  quantity: z.coerce.number({ error: "Enter a quantity" }).positive("More than zero").max(1e6),
  unit_price: money({ positive: true }),
});

export const paymentSchema = z.object({
  paid_on: isoDate,
  account_id: z.string().uuid("Choose an account"),
  bank_account_id: optionalUuid,
});

export const billSchema = z
  .object({
    supplier_org_id: optionalUuid,
    supplier_name: optionalText(200),
    reference: optionalText(120),
    description: z.string().trim().min(2, "What is the bill for?").max(300),
    account_id: optionalUuid,
    issue_date: isoDate,
    due_date: isoDate,
    currency,
    total: money({ positive: true }),
    notes: optionalText(2000),
  })
  .refine((b) => b.supplier_org_id || b.supplier_name, { path: ["supplier_name"], message: "Choose a supplier or type a name" })
  .refine((b) => b.due_date >= b.issue_date, { path: ["due_date"], message: "Due before it's issued" });

export const budgetSchema = z.object({
  account_id: z.string().uuid(),
  month: z.string().regex(/^\d{4}-\d{2}-01$/, "Use the first of the month"),
  amount: money(),
});

export const fxRateSchema = z.object({
  base: currency.refine((c) => c !== "AED", "Rates are entered against AED"),
  rate_date: isoDate,
  rate: z.coerce.number({ error: "Enter the rate" }).positive("More than zero").max(1e6),
});

