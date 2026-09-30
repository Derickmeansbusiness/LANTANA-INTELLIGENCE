import { z } from "zod";
import { isoDate, optionalDate, optionalText, optionalUuid } from "./common";

export const CONTRACT_TYPES = ["ncnda", "mandate_non_circumvention", "engagement", "lease", "employment", "supplier", "spv", "other"] as const;
export const CONTRACT_STATUSES = ["draft", "negotiating", "awaiting_signature", "active", "expired", "terminated"] as const;
export const ESIGN_STATUSES = ["not_sent", "sent", "viewed", "partially_signed", "signed", "declined"] as const;

export const CONTRACT_TYPE_LABEL: Record<(typeof CONTRACT_TYPES)[number], string> = {
  ncnda: "NCNDA",
  mandate_non_circumvention: "Mandate & non-circumvention",
  engagement: "Engagement",
  lease: "Lease",
  employment: "Employment",
  supplier: "Supplier",
  spv: "SPV",
  other: "Other",
};

const optionalInt = (max: number) =>
  z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number({ error: "Enter a whole number" }).int("Enter a whole number").min(0).max(max).nullable().optional());

export const contractSchema = z
  .object({
    title: z.string().trim().min(3, "Give the contract a title").max(300),
    contract_type: z.enum(CONTRACT_TYPES),
    status: z.enum(CONTRACT_STATUSES),
    counterparty_org_id: optionalUuid,
    document_id: optionalUuid,
    owner_id: optionalUuid,
    effective_date: optionalDate,
    term_months: optionalInt(600),
    end_date: optionalDate,
    renewal_type: z.enum(["fixed", "auto_renew"]),
    notice_period_days: optionalInt(730),
    governing_law: optionalText(300),
    forum: optionalText(300),
    exclusivity: optionalText(200),
    fee_terms: optionalText(2000),
    signatory_name: optionalText(200),
    signatory_confirmed: z.boolean().default(false),
    signing_authority_confirmed: z.boolean().default(false),
    counterparty_address_confirmed: z.boolean().default(true),
    esign_status: z.preprocess((v) => (v === "" ? null : v), z.enum(ESIGN_STATUSES).nullable().optional()),
    notes: optionalText(4000),
  })
  .refine((k) => !(k.effective_date && k.end_date) || k.end_date >= k.effective_date, { path: ["end_date"], message: "Ends before it starts" })
  .refine((k) => k.renewal_type !== "auto_renew" || k.notice_period_days != null, { path: ["notice_period_days"], message: "Auto-renewing contracts need a notice period" });

export const survivalSchema = z.object({
  contract_id: z.string().uuid(),
  clause: z.string().trim().min(3, "Which clause survives?").max(300),
  survival_months: z.coerce.number().int().min(1, "At least one month").max(600),
});

export const obligationSchema = z.object({
  contract_id: z.string().uuid(),
  description: z.string().trim().min(3, "Describe the obligation").max(500),
  due_date: z.preprocess((v) => (v === "" ? null : v), isoDate.nullable().optional()),
  owner_id: optionalUuid,
});
