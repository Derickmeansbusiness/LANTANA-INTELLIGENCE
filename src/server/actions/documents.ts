"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClient, createTokenClient, type Db } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/action-result";
import * as docs from "@/server/documents";
import { getSession } from "@/server/session";
import { generateFromTemplate, type GenerateInput } from "@/server/templates/generate";

function refresh(id?: string) {
  revalidatePath("/documents");
  if (id) revalidatePath(`/documents/${id}`);
}

async function accessToken(db: Db) {
  const { data } = await db.auth.getSession();
  return data.session?.access_token ?? null;
}

/** Extract, chunk and embed a version after the response is sent, as the same user. */
async function scheduleIngest(db: Db, versionId: string) {
  const token = await accessToken(db);
  if (!token) return;
  after(async () => {
    try {
      await docs.ingestVersion(createTokenClient(token), versionId, token);
    } catch (e) {
      console.error("ingest failed", versionId, e);
    }
  });
}

export async function createDocumentAction(input: unknown) {
  const r = await docs.createDocument(await createClient(), input);
  if (r.ok) refresh();
  return r;
}

export async function updateDocumentAction(id: string, input: unknown) {
  const r = await docs.updateDocument(await createClient(), id, input);
  if (r.ok) refresh(id);
  return r;
}

export async function setDocumentArchivedAction(id: string, archived: boolean) {
  const r = await docs.setDocumentArchived(await createClient(), id, archived);
  if (r.ok) refresh(id);
  return r;
}

export async function setCheckoutAction(id: string, checkout: boolean) {
  const r = await docs.setCheckout(await createClient(), id, checkout);
  if (r.ok) refresh(id);
  return r;
}

/**
 * Record an uploaded file as the next version, then extract, chunk and embed
 * it once the response has gone out. Ingestion runs under the uploader's own
 * JWT, so it can only touch what they could.
 */
export async function registerVersionAction(input: unknown): Promise<ActionResult<{ versionId: string; versionNo: number }>> {
  const db = await createClient();
  const r = await docs.registerVersion(db, input);
  if (!r.ok) return r;
  await scheduleIngest(db, r.data.versionId);
  refresh((input as { documentId?: string })?.documentId);
  return r;
}

/** Re-run extraction for one version (after a failure or once OCR is configured). */
export async function reingestVersionAction(documentId: string, versionId: string) {
  const db = await createClient();
  const res = await docs.ingestVersion(db, versionId, await accessToken(db));
  refresh(documentId);
  return res.status === "failed" ? { ok: false as const, error: "Couldn't read this file." } : { ok: true as const, data: res };
}

export async function searchDocumentsAction(query: string) {
  const db = await createClient();
  return docs.searchDocuments(db, query, await accessToken(db));
}

export async function versionUrlAction(versionId: string, mode: "view" | "download") {
  return docs.versionUrl(await createClient(), versionId, mode);
}

export async function createShareAction(input: unknown) {
  const r = await docs.createShare(await createClient(), input);
  if (r.ok) refresh((input as { documentId?: string })?.documentId);
  return r;
}

export async function revokeShareAction(documentId: string, id: string) {
  const r = await docs.revokeShare(await createClient(), id);
  if (r.ok) refresh(documentId);
  return r;
}

export async function createFolderAction(name: string, parentId: string | null) {
  const r = await docs.createFolder(await createClient(), name, parentId);
  if (r.ok) refresh();
  return r;
}

export async function generateFromTemplateAction(input: GenerateInput) {
  const db = await createClient();
  const r = await generateFromTemplate(db, await getSession(), input);
  if (r.ok) {
    await scheduleIngest(db, r.data.versionId);
    refresh(r.data.id);
  }
  return r;
}
