import { z } from "zod";

export const SECTORS = ["agriculture", "energy", "real_estate", "infrastructure", "commodities", "industry", "education", "telecoms"] as const;
export const ORG_TYPES = ["investor", "project_owner", "strategic_partner", "introducer", "government", "supplier"] as const;
export const INTRO_CHANNELS = ["email", "meeting", "call", "letter", "whatsapp", "video_call", "other"] as const;
export const INTERACTION_KINDS = ["call", "meeting", "email", "whatsapp", "visit", "other"] as const;

export const label = (s: string) => s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

/** Empty form strings become null so optional FK/date columns stay clean. */
export const optionalText = (max = 2000) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().trim().max(max).nullable().optional());
export const optionalUuid = z.preprocess((v) => (v === "" ? null : v), z.string().uuid().nullable().optional());
export const optionalDate = z.preprocess(
  (v) => (v === "" ? null : v),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date").nullable().optional(),
);
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date");
/** Money typed as major units ("18,500,000.00"); commas allowed. */
export const optionalAmount = z.preprocess((v) => {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(String(v).replace(/[,\s]/g, ""));
  return Number.isFinite(n) ? n : v;
}, z.number({ error: "Enter a number" }).nonnegative("Must be zero or more").max(1e15).nullable().optional());
