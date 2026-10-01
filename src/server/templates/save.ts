import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { Db } from "@/lib/supabase/server";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { safeFileName } from "@/lib/schemas/documents";
import { createDocument, registerVersion } from "@/server/documents";

type Link = { entity_type: "deal" | "organization" | "contract" | "project" | "employee"; entity_id: string };

/**
 * Save a file the app generated (template, report) into the vault as a new
 * document with version 1, under the caller's own session throughout.
 */
export async function saveGeneratedFile(
  db: Db,
  input: {
    title: string;
    docType: string;
    confidentiality: "internal" | "confidential" | "restricted";
    status: "draft" | "final";
    description: string;
    tags: string[];
    links?: Link[];
    format: "pdf" | "docx";
    buf: Buffer;
    note: string;
  },
): Promise<ActionResult<{ id: string; versionId: string }>> {
  const created = await createDocument(db, {
    title: input.title.slice(0, 300),
    doc_type: input.docType,
    confidentiality: input.confidentiality,
    status: input.status,
    description: input.description,
    tags: input.tags,
    links: (input.links ?? []).slice(0, 20),
  });
  if (!created.ok) return created;

  const fileName = `${safeFileName(input.title).replace(/\.+$/, "")}.${input.format}`;
  const path = `${created.data.id}/${randomUUID()}/${fileName}`;
  const mime = input.format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const { error: upErr } = await db.storage.from("documents").upload(path, input.buf, { contentType: mime, upsert: false });
  if (upErr) return fail("The document was created but its file couldn't be saved. Try again.");
  const v = await registerVersion(db, {
    documentId: created.data.id,
    storagePath: path,
    fileName,
    mimeType: mime,
    sizeBytes: input.buf.length,
    sha256: createHash("sha256").update(input.buf).digest("hex"),
    note: input.note,
  });
  if (!v.ok) return v;
  return ok({ id: created.data.id, versionId: v.data.versionId });
}
