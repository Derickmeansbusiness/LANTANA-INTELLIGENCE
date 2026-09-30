import { z } from "zod";
import { INTERACTION_KINDS, ORG_TYPES, SECTORS, isoDate, optionalAmount, optionalText, optionalUuid } from "./common";

export const noteSchema = z.object({
  entityType: z.enum(["deal", "organization", "project"]),
  entityId: z.string().uuid(),
  body: z.string().trim().min(1, "Write something first").max(10000),
  pinned: z.boolean().default(false),
});

export const interactionSchema = z
  .object({
    organization_id: optionalUuid,
    contact_id: optionalUuid,
    deal_id: optionalUuid,
    kind: z.enum(INTERACTION_KINDS),
    occurred_on: isoDate,
    summary: z.string().trim().min(3, "Say what happened").max(5000),
  })
  .refine((v) => v.organization_id || v.deal_id, { message: "Link it to an organization or a deal", path: ["organization_id"] });

export const orgSchema = z.object({
  name: z.string().trim().min(2, "Name the organization").max(200),
  type: z.enum(ORG_TYPES, { error: "Pick a type" }),
  country: z.preprocess((v) => (v === "" ? null : v), z.string().length(2).nullable().optional()),
  regions_of_interest: z.array(z.enum(["africa", "gcc", "other"])).default([]),
  sectors: z.array(z.enum(SECTORS)).default([]),
  ticket_min: optionalAmount,
  ticket_max: optionalAmount,
  ticket_currency: z.string().length(3).default("USD"),
  website: z.preprocess((v) => (v === "" ? null : v), z.string().url("Use a full URL, e.g. https://…").max(300).nullable().optional()),
  description: optionalText(4000),
  relationship_owner_id: optionalUuid,
  status: z.enum(["prospect", "active", "dormant", "closed"]).default("active"),
}).refine((v) => v.ticket_min == null || v.ticket_max == null || v.ticket_min <= v.ticket_max, {
  message: "Minimum is above maximum",
  path: ["ticket_max"],
});

export const contactSchema = z.object({
  organization_id: optionalUuid,
  full_name: z.string().trim().min(2, "Enter a name").max(160),
  job_title: optionalText(160),
  email: z.preprocess((v) => (v === "" ? null : v), z.string().email("Not a valid email").max(254).nullable().optional()),
  phone: optionalText(40),
  country: z.preprocess((v) => (v === "" ? null : v), z.string().length(2).nullable().optional()),
  notes: optionalText(2000),
});
