import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeftIcon, FileTextIcon, LockIcon, ScanTextIcon, SparklesIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { fmtDate, fmtDubai, relativeTime } from "@/lib/dates";
import { label } from "@/lib/schemas/common";
import { getSession } from "@/server/session";
import { getDocument, linkTargets, listFolders, SHAREABLE_MIME } from "@/server/documents";
import { confVariant, fmtSize } from "@/components/documents/format";
import { DocumentActions, IngestPoller, ReingestButton, VersionButtons } from "@/components/documents/document-actions";
import { Preview } from "@/components/documents/preview";
import { SharePanel, type ShareRow } from "@/components/documents/share-panel";

export async function generateMetadata({ params }: PageProps<"/documents/[id]">): Promise<Metadata> {
  const { id } = await params;
  const db = await createClient();
  const { data } = await db.from("documents").select("title").eq("id", id).maybeSingle();
  return { title: data?.title ?? "Document" };
}

const EXTRACTION: Record<string, { text: string; variant: "success" | "warning" | "outline" | "danger" | "info" }> = {
  pending: { text: "Indexing…", variant: "info" },
  done: { text: "Searchable", variant: "success" },
  no_text: { text: "No text found", variant: "outline" },
  needs_ocr: { text: "Scanned, OCR not configured", variant: "warning" },
  unsupported: { text: "Not searchable", variant: "outline" },
  failed: { text: "Couldn't read", variant: "danger" },
};

export default async function DocumentPage({ params }: PageProps<"/documents/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const session = await getSession();
  const db = await createClient();
  const detail = await getDocument(db, id);
  if (!detail) notFound();
  const { doc, versions, links, tags, shares } = detail;
  const [folders, targets] = await Promise.all([listFolders(db), linkTargets(db)]);

  const current = versions.find((v) => v.id === doc.current_version_id) ?? versions[0] ?? null;
  const canEdit = session.isManagerPlus || doc.created_by === session.userId;
  const lockedByMe = doc.checked_out_by === session.userId;
  const lockedByOther = doc.checked_out_by && !lockedByMe ? (doc.locker?.full_name ?? "someone") : null;
  const archived = Boolean(doc.deleted_at);
  const shareBlock = archived
    ? "Archived documents can't be shared."
    : !current
      ? "Upload a file before sharing."
      : !SHAREABLE_MIME.includes(current.mime_type ?? "")
        ? "Only PDFs and images can be shared, because only those can be watermarked."
        : doc.confidentiality === "restricted" && !session.isPrincipal
          ? "Only a principal can share a restricted document."
          : null;
  const indexing = versions.some((v) => v.extraction_status === "pending");

  return (
    <div className="mx-auto max-w-[1440px] space-y-5">
      <IngestPoller pending={indexing} />
      <div>
        <Link href="/documents" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ChevronLeftIcon className="size-3.5" /> Documents
        </Link>
        <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h1 className="font-display text-2xl leading-tight sm:text-[28px]">{doc.title}</h1>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge variant="gold">{label(doc.doc_type)}</Badge>
              <Badge variant={confVariant(doc.confidentiality)}>{label(doc.confidentiality)}</Badge>
              <Badge>{label(doc.status)}</Badge>
              {doc.checked_out_by && (
                <Badge variant="warning">
                  <LockIcon className="size-3" /> Checked out by {lockedByMe ? "you" : lockedByOther}
                </Badge>
              )}
              {archived && <Badge variant="danger">Archived</Badge>}
              {doc.is_demo && <Badge variant="warning">Demo</Badge>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <DocumentActions
              docId={id}
              currentVersionId={current?.id ?? null}
              folders={folders}
              targets={targets}
              canEdit={canEdit}
              canManage={session.isManagerPlus}
              lockedByMe={lockedByMe}
              lockedByOther={lockedByOther}
              archived={archived}
              initial={{
                title: doc.title,
                folder_id: doc.folder_id ?? "",
                doc_type: doc.doc_type,
                confidentiality: doc.confidentiality,
                status: doc.status,
                expiry_date: doc.expiry_date ?? "",
                description: doc.description ?? "",
                tags: tags.map((t) => t.name).join(", "),
                links: links.map((l) => ({ entity_type: l.entity_type, entity_id: l.entity_id })),
              }}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-12 [&>*]:min-w-0">
        <div className="space-y-5 xl:col-span-8">
          <Card>
            <CardHeader>
              <div className="min-w-0">
                <CardTitle>{current ? current.file_name : "No file yet"}</CardTitle>
                <CardDescription>
                  {current ? (
                    <>
                      Version {current.version_no} · <span className="num">{fmtSize(current.size_bytes)}</span>
                      {current.page_count ? ` · ${current.page_count} page${current.page_count === 1 ? "" : "s"}` : ""} · uploaded {relativeTime(current.created_at)}
                    </>
                  ) : (
                    "Upload the signed copy to preview and search it here."
                  )}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {current ? (
                <Preview key={current.id} versionId={current.id} mime={current.mime_type} fileName={current.file_name} />
              ) : (
                <div className="flex h-48 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                  <FileTextIcon className="size-8" />
                  {doc.description ?? "No file uploaded yet."}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5 xl:col-span-4">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <Fact label="Folder">{doc.folder?.name ?? "Unfiled"}</Fact>
                <Fact label="Expires">{doc.expiry_date ? fmtDate(doc.expiry_date) : "—"}</Fact>
                <Fact label="Added by">{doc.creator?.full_name ?? "—"}</Fact>
                <Fact label="Added">{fmtDate(doc.created_at)}</Fact>
              </dl>
              {doc.description && current && <p className="mt-3 text-sm text-muted-foreground">{doc.description}</p>}
              {tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {tags.map((t) => (
                    <Badge key={t.id} variant="outline">
                      {t.name}
                    </Badge>
                  ))}
                </div>
              )}
              <h3 className="mt-4 mb-1.5 text-xs font-medium text-muted-foreground">Linked to</h3>
              {links.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing yet.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {links.map((l) => (
                    <li key={`${l.entity_type}:${l.entity_id}`}>
                      <span className="text-muted-foreground">{label(l.entity_type)}:</span>{" "}
                      <Link href={l.href} className="hover:text-gold-ink">
                        {l.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Versions</CardTitle>
                <CardDescription>Stored files never change. A new upload becomes a new version.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {versions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No versions yet.</p>
              ) : (
                <ol className="space-y-3">
                  {versions.map((v) => {
                    const ex = EXTRACTION[v.extraction_status] ?? EXTRACTION.pending;
                    return (
                      <li key={v.id} className="text-sm">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate font-medium">
                              v{v.version_no} · {v.file_name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {v.author?.full_name ?? "—"} · <span className="num">{fmtDubai(v.created_at, "d MMM yyyy, HH:mm")}</span> · <span className="num">{fmtSize(v.size_bytes)}</span>
                            </p>
                            {v.note && <p className="mt-0.5 text-xs">{v.note}</p>}
                            <div className="mt-1 flex flex-wrap gap-1">
                              <Badge variant={ex.variant}>{ex.text}</Badge>
                              {v.ocr_used && (
                                <Badge variant="outline">
                                  <ScanTextIcon className="size-3" /> OCR
                                </Badge>
                              )}
                              {v.embedded && (
                                <Badge variant="outline">
                                  <SparklesIcon className="size-3" /> Semantic
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center">
                            {canEdit && ["failed", "needs_ocr", "pending"].includes(v.extraction_status) && <ReingestButton docId={id} versionId={v.id} />}
                            <VersionButtons versionId={v.id} />
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Share links</CardTitle>
                <CardDescription>Expiring, watermarked, every open logged.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <SharePanel docId={id} shares={shares as unknown as ShareRow[]} canShare={!shareBlock} reason={shareBlock} now={detail.asOf} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Fact({ label: l, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{l}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}
