import "server-only";
import type { Db } from "@/lib/supabase/server";
import { fail, fieldErrors, ok, type ActionResult } from "@/lib/action-result";
import { createHash, randomBytes } from "node:crypto";
import { documentSchema, shareSchema, versionSchema } from "@/lib/schemas/documents";
import { chunkText } from "./documents/chunk";
import { extractText } from "./documents/extract";
import { ocrAvailable, ocrWithClaude } from "./documents/ocr";
import { embedTexts, toPgVector } from "./documents/embeddings";

/** Documents vault domain. RLS (and matching storage policies) decide access. */

export type DocRow = {
  id: string;
  title: string;
  doc_type: string;
  confidentiality: string;
  status: string;
  expiry_date: string | null;
  folder_id: string | null;
  folder_name: string | null;
  updated_at: string;
  checked_out_by: string | null;
  checked_out_name: string | null;
  file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  version_no: number | null;
  extraction_status: string | null;
  tags: string[];
  is_demo: boolean;
};

export async function listDocuments(db: Db): Promise<DocRow[]> {
  const { data, error } = await db
    .from("documents")
    .select(
      "id, title, doc_type, confidentiality, status, expiry_date, folder_id, updated_at, checked_out_by, is_demo, folder:folders(name), " +
        "locker:profiles!documents_checked_out_by_fkey(full_name), current:document_versions!documents_current_version_fk(file_name, mime_type, size_bytes, version_no, extraction_status), " +
        "doc_tags:document_tags(tag:tags(name))",
    )
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .returns<RawDoc[]>();
  if (error) throw new Error(error.message);
  return (data ?? []).map((d) => ({
    id: d.id,
    title: d.title,
    doc_type: d.doc_type,
    confidentiality: d.confidentiality,
    status: d.status,
    expiry_date: d.expiry_date,
    folder_id: d.folder_id,
    folder_name: d.folder?.name ?? null,
    updated_at: d.updated_at,
    checked_out_by: d.checked_out_by,
    checked_out_name: d.locker?.full_name ?? null,
    file_name: d.current?.file_name ?? null,
    mime_type: d.current?.mime_type ?? null,
    size_bytes: d.current?.size_bytes ?? null,
    version_no: d.current?.version_no ?? null,
    extraction_status: d.current?.extraction_status ?? null,
    tags: (d.doc_tags ?? []).map((t) => t.tag?.name).filter(Boolean) as string[],
    is_demo: d.is_demo,
  }));
}

type RawDoc = {
  id: string;
  title: string;
  doc_type: string;
  confidentiality: string;
  status: string;
  expiry_date: string | null;
  folder_id: string | null;
  updated_at: string;
  checked_out_by: string | null;
  is_demo: boolean;
  folder: { name: string } | null;
  locker: { full_name: string } | null;
  current: { file_name: string; mime_type: string | null; size_bytes: number | null; version_no: number; extraction_status: string } | null;
  doc_tags: { tag: { name: string } | null }[];
};

export async function listFolders(db: Db) {
  const { data } = await db.from("folders").select("id, name, parent_id").is("deleted_at", null).order("name");
  return data ?? [];
}

export async function getDocument(db: Db, id: string) {
  const { data: doc } = await db
    .from("documents")
    .select("*, folder:folders(id, name), locker:profiles!documents_checked_out_by_fkey(id, full_name), creator:profiles!documents_created_by_fkey(full_name)")
    .eq("id", id)
    .maybeSingle();
  if (!doc) return null;
  const [versions, links, tags, shares] = await Promise.all([
    db
      .from("document_versions")
      .select("id, version_no, file_name, mime_type, size_bytes, sha256, extraction_status, page_count, text_chars, ocr_used, embedded, note, created_at, author:profiles!document_versions_created_by_fkey(full_name)")
      .eq("document_id", id)
      .order("version_no", { ascending: false }),
    db.from("document_links").select("entity_type, entity_id").eq("document_id", id),
    db.from("document_tags").select("tag:tags(id, name)").eq("document_id", id),
    db
      .from("document_share_links")
      .select("id, recipient_name, recipient_email, expires_at, max_views, view_count, revoked_at, created_at, version_id, creator:profiles!document_share_links_created_by_fkey(full_name), views:document_share_views(viewed_at, outcome)")
      .eq("document_id", id)
      .order("created_at", { ascending: false }),
  ]);

  // Resolve link targets to names (RLS hides what the caller can't see).
  const byType = (t: string) => (links.data ?? []).filter((l) => l.entity_type === t).map((l) => l.entity_id);
  const [deals, orgs, contracts, projects] = await Promise.all([
    byType("deal").length ? db.from("deals").select("id, name").in("id", byType("deal")) : { data: [] as { id: string; name: string }[] },
    byType("organization").length ? db.from("organizations").select("id, name").in("id", byType("organization")) : { data: [] as { id: string; name: string }[] },
    byType("contract").length ? db.from("contracts").select("id, title").in("id", byType("contract")) : { data: [] as { id: string; title: string }[] },
    byType("project").length ? db.from("projects").select("id, name").in("id", byType("project")) : { data: [] as { id: string; name: string }[] },
  ]);
  const resolved = [
    ...(deals.data ?? []).map((d) => ({ entity_type: "deal" as const, entity_id: d.id, name: d.name, href: `/deals/${d.id}` })),
    ...(orgs.data ?? []).map((d) => ({ entity_type: "organization" as const, entity_id: d.id, name: d.name, href: `/partners/${d.id}` })),
    ...(contracts.data ?? []).map((d) => ({ entity_type: "contract" as const, entity_id: d.id, name: d.title, href: `/contracts/${d.id}` })),
    ...(projects.data ?? []).map((d) => ({ entity_type: "project" as const, entity_id: d.id, name: d.name, href: `/tasks/projects/${d.id}` })),
  ];

  return {
    doc,
    versions: versions.data ?? [],
    links: resolved,
    tags: (tags.data ?? []).map((t) => t.tag).filter(Boolean) as { id: string; name: string }[],
    shares: shares.data ?? [],
    /** Server clock, so share status is computed once per request. */
    asOf: Date.now(),
  };
}

async function setTagsAndLinks(db: Db, documentId: string, tags: string[], links: { entity_type: string; entity_id: string }[], replace: boolean) {
  if (replace) {
    await db.from("document_tags").delete().eq("document_id", documentId);
    await db.from("document_links").delete().eq("document_id", documentId);
  }
  const names = [...new Set(tags.map((t) => t.trim()).filter(Boolean))];
  if (names.length) {
    const { data: existing } = await db.from("tags").select("id, name");
    const map = new Map((existing ?? []).map((t) => [t.name.toLowerCase(), t.id]));
    for (const n of names.filter((n) => !map.has(n.toLowerCase()))) {
      const { data } = await db.from("tags").insert({ name: n }).select("id, name").single();
      if (data) map.set(data.name.toLowerCase(), data.id);
    }
    const rows = names.map((n) => ({ document_id: documentId, tag_id: map.get(n.toLowerCase())! })).filter((r) => r.tag_id);
    if (rows.length) {
      const { error } = await db.from("document_tags").insert(rows);
      if (error) return error;
    }
  }
  if (links.length) {
    const { error } = await db.from("document_links").insert(links.map((l) => ({ document_id: documentId, ...l })));
    if (error) return error;
  }
  return null;
}

export async function createDocument(db: Db, input: unknown): Promise<ActionResult<{ id: string }>> {
  const p = documentSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(p.error.issues) };
  const { tags, links, ...meta } = p.data;
  const { data, error } = await db
    .from("documents")
    .insert({ ...meta, folder_id: meta.folder_id ?? null, expiry_date: meta.expiry_date ?? null, description: meta.description ?? null })
    .select("id")
    .single();
  if (error) return fail(error);
  const e2 = await setTagsAndLinks(db, data.id, tags, links, false);
  if (e2) return fail(e2);
  return ok({ id: data.id });
}

export async function updateDocument(db: Db, id: string, input: unknown): Promise<ActionResult> {
  const p = documentSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(p.error.issues) };
  const { tags, links, ...meta } = p.data;
  const { data, error } = await db
    .from("documents")
    .update({ ...meta, folder_id: meta.folder_id ?? null, expiry_date: meta.expiry_date ?? null, description: meta.description ?? null })
    .eq("id", id)
    .select("id");
  if (error) return fail(error);
  if (!data?.length) return fail("Document not found or you can't edit it.");
  const e2 = await setTagsAndLinks(db, id, tags, links, true);
  return e2 ? fail(e2) : ok(undefined);
}

export async function setDocumentArchived(db: Db, id: string, archived: boolean): Promise<ActionResult> {
  const { data, error } = await db.from("documents").update({ deleted_at: archived ? new Date().toISOString() : null }).eq("id", id).select("id");
  if (error) return fail(error);
  return data?.length ? ok(undefined) : fail("Only a manager or principal can archive documents.");
}

export async function setCheckout(db: Db, id: string, checkout: boolean): Promise<ActionResult> {
  const { data: claims } = await db.auth.getClaims();
  const me = claims?.claims?.sub;
  const { data: doc } = await db.from("documents").select("checked_out_by").eq("id", id).maybeSingle();
  if (!doc) return fail("Document not found.");
  if (checkout && doc.checked_out_by && doc.checked_out_by !== me) return fail("Someone else already has it checked out.");
  const { data: prof } = await db.from("profiles").select("role").eq("id", me!).maybeSingle();
  if (!checkout && doc.checked_out_by && doc.checked_out_by !== me && !["principal", "manager"].includes(prof?.role ?? "")) {
    return fail("Only the person who checked it out, or a manager, can check it back in.");
  }
  const { data, error } = await db.from("documents").update({ checked_out_by: checkout ? me : null }).eq("id", id).select("id");
  if (error) return fail(error);
  return data?.length ? ok(undefined) : fail("You can't change this document.");
}

export async function registerVersion(db: Db, input: unknown): Promise<ActionResult<{ versionId: string; versionNo: number }>> {
  const p = versionSchema.safeParse(input);
  if (!p.success) return fail(p.error.issues[0]?.message ?? "Invalid upload");
  if (!p.data.storagePath.startsWith(`${p.data.documentId}/`)) return fail("Storage path doesn't match the document.");
  const { data, error } = await db
    .from("document_versions")
    .insert({
      document_id: p.data.documentId,
      version_no: 0, // assigned by the database
      storage_path: p.data.storagePath,
      file_name: p.data.fileName,
      mime_type: p.data.mimeType,
      size_bytes: p.data.sizeBytes,
      sha256: p.data.sha256,
      note: p.data.note ?? null,
    })
    .select("id, version_no")
    .single();
  if (error) return fail(error);
  return ok({ versionId: data.id, versionNo: data.version_no });
}

/**
 * Extract → chunk → index → embed one version, under the caller's JWT.
 * Replaces the document's previous chunks: search covers the current
 * version only. Status lands on the version row either way.
 */
export async function ingestVersion(db: Db, versionId: string, accessToken: string | null) {
  const { data: v } = await db.from("document_versions").select("id, document_id, storage_path, file_name, mime_type").eq("id", versionId).maybeSingle();
  if (!v) return { status: "failed" as const, error: "Version not found" };
  const { data: blob, error: dlErr } = await db.storage.from("documents").download(v.storage_path);
  if (dlErr || !blob) {
    await db.from("document_versions").update({ extraction_status: "failed" }).eq("id", v.id);
    return { status: "failed" as const, error: dlErr?.message };
  }
  const buf = Buffer.from(await blob.arrayBuffer());
  let ex = await extractText(buf, v.mime_type, v.file_name);
  let ocrUsed = false;
  if (ex.status === "needs_ocr" && ocrAvailable()) {
    const text = await ocrWithClaude(buf, v.mime_type ?? "");
    if (text) {
      ex = { text, pages: ex.pages, status: "done" };
      ocrUsed = true;
    }
  }

  const chunks = ex.status === "done" ? chunkText(ex.text) : [];
  await db.from("document_chunks").delete().eq("document_id", v.document_id);
  let embedded = false;
  if (chunks.length) {
    const vectors = accessToken ? await embedTexts(chunks, accessToken) : null;
    embedded = Boolean(vectors);
    for (let i = 0; i < chunks.length; i += 200) {
      const rows = chunks.slice(i, i + 200).map((content, j) => ({
        document_id: v.document_id,
        version_id: v.id,
        ordinal: i + j,
        content,
        embedding: vectors ? toPgVector(vectors[i + j]) : null,
      }));
      const { error } = await db.from("document_chunks").insert(rows);
      if (error) {
        await db.from("document_versions").update({ extraction_status: "failed" }).eq("id", v.id);
        return { status: "failed" as const, error: error.message };
      }
    }
  }
  await db
    .from("document_versions")
    .update({
      extraction_status: ex.status === "done" && !chunks.length ? "no_text" : ex.status,
      page_count: ex.pages,
      text_chars: ex.text.length,
      ocr_used: ocrUsed,
      embedded,
    })
    .eq("id", v.id);
  return { status: ex.status, chunks: chunks.length, embedded };
}

export async function searchDocuments(db: Db, query: string, accessToken: string | null) {
  const q = query.trim().slice(0, 300);
  if (q.length < 2) return { results: [], semantic: false };
  const vec = accessToken ? await embedTexts([q], accessToken) : null;
  const { data, error } = await db.rpc("search_documents", {
    p_query: q,
    p_embedding: vec ? toPgVector(vec[0]) : undefined,
    p_limit: 20,
  });
  if (error) throw new Error(error.message);
  return { results: data ?? [], semantic: Boolean(vec) };
}

/** Short-lived signed URL for one version; logs a download/view event. */
export async function versionUrl(db: Db, versionId: string, mode: "view" | "download"): Promise<ActionResult<{ url: string }>> {
  const { data: v } = await db.from("document_versions").select("id, document_id, storage_path, file_name").eq("id", versionId).maybeSingle();
  if (!v) return fail("File not found or you don't have access.");
  const { data, error } = await db.storage.from("documents").createSignedUrl(v.storage_path, 120, mode === "download" ? { download: v.file_name } : undefined);
  if (error || !data) return fail("Couldn't prepare the file. Try again.");
  await db.rpc("log_event", { p_action: mode === "download" ? "download" : "view", p_table: "documents", p_row_id: v.document_id, p_context: { version_id: v.id } });
  return ok({ url: data.signedUrl });
}

/** Only formats we can watermark may leave the building. */
export const SHAREABLE_MIME = ["application/pdf", "image/png", "image/jpeg"];

/**
 * Create a share link for the document's current version. The raw token is
 * returned once and never stored: the database keeps its sha256 only.
 */
export async function createShare(db: Db, input: unknown): Promise<ActionResult<{ token: string; expiresAt: string }>> {
  const p = shareSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(p.error.issues) };
  const { data: doc } = await db
    .from("documents")
    .select("id, current:document_versions!documents_current_version_fk(id, mime_type)")
    .eq("id", p.data.documentId)
    .maybeSingle<{ id: string; current: { id: string; mime_type: string | null } | null }>();
  if (!doc) return fail("Document not found.");
  if (!doc.current) return fail("Upload a file before sharing.");
  if (!SHAREABLE_MIME.includes(doc.current.mime_type ?? "")) {
    return fail("Only PDFs and images can be shared, because only those can be watermarked. Export a PDF first.");
  }
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + p.data.days * 86_400_000).toISOString();
  const { error } = await db.from("document_share_links").insert({
    document_id: doc.id,
    version_id: doc.current.id,
    token_hash: createHash("sha256").update(token).digest("hex"),
    recipient_name: p.data.recipientName,
    recipient_email: p.data.recipientEmail ?? null,
    expires_at: expiresAt,
    max_views: p.data.maxViews,
  });
  if (error) {
    if (error.code === "42501") return fail("You can't share this document. Restricted documents need a principal.");
    return fail(error);
  }
  return ok({ token, expiresAt });
}

export async function revokeShare(db: Db, id: string): Promise<ActionResult> {
  const { data, error } = await db.from("document_share_links").update({ revoked_at: new Date().toISOString() }).eq("id", id).select("id");
  if (error) return fail(error);
  return data?.length ? ok(undefined) : fail("Link not found or you can't revoke it.");
}

export type LinkTarget = { entity_type: "deal" | "organization" | "contract" | "project"; entity_id: string; name: string };

/** Everything the caller may link a document to (RLS trims each list). */
export async function linkTargets(db: Db): Promise<LinkTarget[]> {
  const [deals, orgs, contracts, projects] = await Promise.all([
    db.from("deals").select("id, name").is("deleted_at", null).order("name"),
    db.from("organizations").select("id, name").is("deleted_at", null).order("name"),
    db.from("contracts").select("id, title").is("deleted_at", null).order("title"),
    db.from("projects").select("id, name").is("deleted_at", null).order("name"),
  ]);
  return [
    ...(deals.data ?? []).map((r) => ({ entity_type: "deal" as const, entity_id: r.id, name: r.name })),
    ...(orgs.data ?? []).map((r) => ({ entity_type: "organization" as const, entity_id: r.id, name: r.name })),
    ...(contracts.data ?? []).map((r) => ({ entity_type: "contract" as const, entity_id: r.id, name: r.title })),
    ...(projects.data ?? []).map((r) => ({ entity_type: "project" as const, entity_id: r.id, name: r.name })),
  ];
}

export async function createFolder(db: Db, name: string, parentId: string | null): Promise<ActionResult<{ id: string }>> {
  const n = name.trim();
  if (n.length < 2 || n.length > 80) return fail("Folder names are 2–80 characters.");
  const { data, error } = await db.from("folders").insert({ name: n, parent_id: parentId }).select("id").single();
  if (error) return fail(error.code === "42501" ? "Only a manager or principal can create folders." : error);
  return ok({ id: data.id });
}
