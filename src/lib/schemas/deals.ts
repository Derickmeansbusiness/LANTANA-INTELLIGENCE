import { z } from "zod";
import { SECTORS, isoDate, optionalAmount, optionalDate, optionalText, optionalUuid } from "./common";

export const dealSchema = z.object({
  name: z.string().trim().min(2, "Name the deal").max(160),
  country: z.preprocess((v) => (v === "" ? null : v), z.string().length(2).nullable().optional()),
  sector: z.enum(SECTORS, { error: "Pick a sector" }),
  ticket: optionalAmount,
  currency: z.string().length(3),
  probability: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().min(0).max(100).nullable().optional()),
  project_owner_org_id: optionalUuid,
  introducer_org_id: optionalUuid,
  fee_terms: optionalText(500),
  spv_planned: z.preprocess((v) => v === true || v === "on" || v === "true", z.boolean()),
  next_step: optionalText(300),
  next_step_due: optionalDate,
  expected_close_date: optionalDate,
  owner_id: optionalUuid,
  summary: optionalText(4000),
});
export type DealInput = z.input<typeof dealSchema>;

export const createDealSchema = dealSchema.extend({ stage: z.string().min(1).default("lead") });

export const moveStageSchema = z.object({
  dealId: z.string().uuid(),
  stage: z.string().min(1),
  note: optionalText(1000),
});

export const partySchema = z.object({
  dealId: z.string().uuid(),
  organizationId: z.string().uuid("Pick an organization"),
  role: z.enum(["investor_introduced", "investor_interested", "buyer", "supplier", "co_advisor", "lender", "other"]),
});

export const introductionSchema = z.object({
  introduced_on: isoDate,
  deal_id: optionalUuid,
  party_a_org_id: z.string().uuid("Pick party A"),
  party_a_contact_id: optionalUuid,
  party_b_org_id: z.string().uuid("Pick party B"),
  party_b_contact_id: optionalUuid,
  channel: z.enum(["email", "meeting", "call", "letter", "whatsapp", "video_call", "other"]),
  summary: z.string().trim().min(10, "Describe the introduction (at least a sentence)").max(2000),
  corrects_id: optionalUuid,
}).refine((v) => v.party_a_org_id !== v.party_b_org_id, { message: "Party A and party B must differ", path: ["party_b_org_id"] });
