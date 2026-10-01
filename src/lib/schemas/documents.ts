import { z } from "zod";
import { optionalDate, optionalText, optionalUuid } from "./common";

export const DOC_TYPES = ["agreement", "letter", "lease", "presentation", "proposal", "invoice", "certificate", "resolution", "licence", "statement", "report", "other"] as const;
export const CONFIDENTIALITY = ["public", "internal", "confidential", "restricted"] as const;
export const DOC_STATUSES = ["draft", "awaiting_signature", "signed", "final", "superseded"] as const;

export const documentSchema = z.object({
  title: z.string().trim().min(2, "Give the document a title").max(300),
  folder_id: optionalUuid,
  doc_type: z.enum(DOC_TYPES),
  confidentiality: z.enum(CONFIDENTIALITY),
  status: z.enum(DOC_STATUSES),
  expiry_date: optionalDate,
  description: optionalText(4000),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  links: z.array(z.object({ entity_type: z.enum(["deal", "organization", "contract", "project", "employee"]), entity_id: z.string().uuid() })).max(20).default([]),
});

export const versionSchema = z.object({
  documentId: z.string().uuid(),
  storagePath: z.string().regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[^/]{1,200}$/, "Bad storage path"),
  fileName: z.string().min(1).max(200),
  mimeType: z.string().max(200).nullable(),
  sizeBytes: z.number().int().nonnegative().max(52_428_800, "Files are limited to 50 MB"),
  sha256: z.string().regex(/^[0-9a-f]{64}$/).nullable(),
  note: optionalText(500),
});

export const shareSchema = z.object({
  documentId: z.string().uuid(),
  recipientName: z.string().trim().min(2, "Who is it for?").max(160),
  recipientEmail: z.preprocess((v) => (v === "" ? null : v), z.string().email("Not a valid email").nullable().optional()),
  days: z.coerce.number().int().min(1).max(30),
  maxViews: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().min(1).max(1000).nullable()),
});

/** Safe storage file name: keep letters, digits, dot, dash, underscore. */
export function safeFileName(name: string) {
  const base = name.normalize("NFKD").replace(/[^\w.\-]+/g, "_").replace(/_+/g, "_").replace(/^[._]+/, "");
  return (base || "file").slice(-120);
}
