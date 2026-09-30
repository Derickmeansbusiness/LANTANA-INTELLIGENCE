"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { FileSignatureIcon, FolderIcon, FolderPlusIcon, LockIcon, SearchIcon, SparklesIcon, UploadIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/form-field";
import { DataTable } from "@/components/data-table/data-table";
import type { SavedView } from "@/components/data-table/types";
import { PageHeader } from "@/components/page-header";
import { fmtDate, relativeTime } from "@/lib/dates";
import { CONFIDENTIALITY, DOC_STATUSES, DOC_TYPES } from "@/lib/schemas/documents";
import { label } from "@/lib/schemas/common";
import { cn } from "@/lib/utils";
import { createFolderAction, searchDocumentsAction } from "@/server/actions/documents";
import type { DocRow, LinkTarget } from "@/server/documents";
import { UploadDialog } from "./upload-dialog";
import { confVariant, fmtSize } from "./format";

type SearchHit = { document_id: string; title: string; doc_type: string; status: string; snippet: string | null; matched: string };


const columns: ColumnDef<DocRow, unknown>[] = [
  {
    accessorKey: "title",
    header: "Document",
    enableHiding: false,
    meta: { label: "Document", className: "min-w-64" },
    cell: ({ row }) => (
      <div className="min-w-0">
        <Link href={`/documents/${row.original.id}`} className="font-medium hover:text-gold-ink">
          {row.original.title}
        </Link>
        {row.original.is_demo && <Badge variant="outline" className="ml-2 align-middle">Demo</Badge>}
        <div className="mt-0.5 truncate text-xs text-muted-foreground">
          {row.original.file_name ? (
            <>
              {row.original.file_name} · <span className="num">{fmtSize(row.original.size_bytes)}</span> · v{row.original.version_no}
            </>
          ) : (
            "No file uploaded yet"
          )}
          {row.original.checked_out_name && (
            <span className="ml-1.5 inline-flex items-center gap-0.5 text-warning">
              <LockIcon className="size-3" /> {row.original.checked_out_name}
            </span>
          )}
        </div>
      </div>
    ),
  },
  { accessorKey: "doc_type", header: "Type", meta: { label: "Type", csv: (r) => label(r.doc_type) }, cell: ({ getValue }) => label(String(getValue())) },
  {
    accessorKey: "confidentiality",
    header: "Access",
    meta: { label: "Confidentiality", csv: (r) => label(r.confidentiality) },
    cell: ({ getValue }) => <Badge variant={confVariant(String(getValue()))}>{label(String(getValue()))}</Badge>,
  },
  { accessorKey: "status", header: "Status", meta: { label: "Status", csv: (r) => label(r.status) }, cell: ({ getValue }) => label(String(getValue())) },
  { accessorKey: "folder_name", header: "Folder", meta: { label: "Folder" }, cell: ({ getValue }) => (getValue() as string) ?? "Unfiled" },
  {
    accessorKey: "tags",
    header: "Tags",
    enableSorting: false,
    meta: { label: "Tags", csv: (r) => r.tags.join("; ") },
    cell: ({ row }) => (
      <div className="flex max-w-52 flex-wrap gap-1">
        {row.original.tags.map((t) => (
          <Badge key={t} variant="outline">
            {t}
          </Badge>
        ))}
      </div>
    ),
  },
  {
    accessorKey: "expiry_date",
    header: "Expires",
    sortUndefined: "last",
    meta: { label: "Expiry date" },
    cell: ({ getValue }) => <span className="num text-muted-foreground">{getValue() ? fmtDate(getValue() as string) : "—"}</span>,
  },
  {
    accessorKey: "updated_at",
    header: "Updated",
    meta: { label: "Last updated" },
    cell: ({ getValue }) => <span className="num text-muted-foreground">{relativeTime(getValue() as string)}</span>,
  },
];

function Snippet({ text }: { text: string }) {
  // search_documents marks hits with «…»; render them as <mark>, everything else as text.
  const parts = text.split(/(«[^»]*»)/g);
  return (
    <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">
      {parts.map((p, i) =>
        p.startsWith("«") ? (
          <mark key={i} className="rounded-sm bg-gold-wash px-0.5 text-foreground">
            {p.slice(1, -1)}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </p>
  );
}

export function DocumentsView({
  docs,
  folders,
  targets,
  views,
  canManage,
}: {
  docs: DocRow[];
  folders: { id: string; name: string; parent_id: string | null }[];
  targets: LinkTarget[];
  views: SavedView[];
  canManage: boolean;
}) {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const folder = sp.get("folder") ?? "all";
  const [upload, setUpload] = useState(false);
  const [newFolder, setNewFolder] = useState(false);
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [hits, setHits] = useState<{ q: string; results: SearchHit[]; semantic: boolean } | null>(null);
  const [searching, startSearch] = useTransition();

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of docs) m.set(d.folder_id ?? "none", (m.get(d.folder_id ?? "none") ?? 0) + 1);
    return m;
  }, [docs]);
  const rows = useMemo(() => (folder === "all" ? docs : docs.filter((d) => (d.folder_id ?? "none") === folder)), [docs, folder]);
  const setFolder = (f: string) => router.replace(f === "all" ? pathname : `${pathname}?folder=${f}`, { scroll: false });

  function runSearch(e: React.FormEvent) {
    e.preventDefault();
    const query = q.trim();
    if (query.length < 2) return setHits(null);
    startSearch(async () => {
      try {
        const r = await searchDocumentsAction(query);
        setHits({ q: query, results: r.results as SearchHit[], semantic: r.semantic });
      } catch {
        toast.error("Search failed. Try again.");
      }
    });
  }

  const folderList = [
    { id: "all", name: "All documents", n: docs.length },
    ...folders.map((f) => ({ id: f.id, name: f.name, n: counts.get(f.id) ?? 0 })),
    { id: "none", name: "Unfiled", n: counts.get("none") ?? 0 },
  ];

  return (
    <div className="mx-auto max-w-[1440px]">
      <PageHeader
        title="Documents"
        description="Every agreement, letter and certificate, versioned and searchable. Files stay private; share them only through expiring links."
        actions={
          <>
            {canManage && (
              <Button variant="outline" size="sm" onClick={() => setNewFolder(true)}>
                <FolderPlusIcon /> New folder
              </Button>
            )}
            <Button variant="outline" size="sm" asChild>
              <Link href="/documents/templates">
                <FileSignatureIcon /> Templates
              </Link>
            </Button>
            <Button size="sm" onClick={() => setUpload(true)}>
              <UploadIcon /> Upload
            </Button>
          </>
        }
      />

      <form onSubmit={runSearch} className="mb-4 flex gap-2" role="search">
        <div className="relative min-w-0 flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search inside documents, e.g. “non-circumvention survival”"
            className="pl-8"
            aria-label="Search inside documents"
          />
        </div>
        <Button type="submit" variant="outline" disabled={searching}>
          {searching ? "Searching…" : "Search"}
        </Button>
      </form>

      {hits && (
        <Card className="mb-5">
          <CardContent className="pt-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-sm">
                <span className="num">{hits.results.length}</span> result{hits.results.length === 1 ? "" : "s"} for <span className="font-medium">“{hits.q}”</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {hits.semantic ? (
                    <span className="inline-flex items-center gap-1">
                      <SparklesIcon className="size-3 text-gold" /> keyword + meaning
                    </span>
                  ) : (
                    "keyword match"
                  )}
                </span>
              </p>
              <Button variant="ghost" size="sm" onClick={() => setHits(null)} aria-label="Clear search results">
                <XIcon />
              </Button>
            </div>
            {hits.results.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing matched. Only uploaded files with a text layer (or OCR) are searchable inside; titles always are.</p>
            ) : (
              <ul className="divide-y">
                {hits.results.map((h) => (
                  <li key={h.document_id} className="py-2.5">
                    <Link href={`/documents/${h.document_id}`} className="font-medium hover:text-gold-ink">
                      {h.title}
                    </Link>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {label(h.doc_type)} · {label(h.status)}
                    </span>
                    {h.snippet && <Snippet text={h.snippet} />}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-[220px_1fr] [&>*]:min-w-0">
        <nav aria-label="Folders" className="hidden lg:block">
          <ul className="space-y-0.5">
            {folderList.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => setFolder(f.id)}
                  aria-current={folder === f.id ? "page" : undefined}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors",
                    folder === f.id ? "bg-gold-wash text-gold-ink" : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
                  )}
                >
                  <FolderIcon className="size-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{f.name}</span>
                  <span className="num text-xs">{f.n}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="space-y-3">
          <div className="lg:hidden">
            <NativeSelect aria-label="Folder" value={folder} onChange={(e) => setFolder(e.target.value)}>
              {folderList.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} ({f.n})
                </option>
              ))}
            </NativeSelect>
          </div>
          <DataTable
            module="documents"
            columns={columns}
            data={rows}
            views={views}
            csvName="lantana-documents"
            rowHref={(d) => `/documents/${d.id}`}
            searchPlaceholder="Filter by title, file or tag…"
            defaultHidden={["tags", "folder_name"]}
            facets={[
              { columnId: "doc_type", label: "Types", options: DOC_TYPES.map((t) => ({ value: t, label: label(t) })) },
              { columnId: "confidentiality", label: "Access", options: CONFIDENTIALITY.map((t) => ({ value: t, label: label(t) })) },
              { columnId: "status", label: "Status", options: DOC_STATUSES.map((t) => ({ value: t, label: label(t) })) },
            ]}
            empty={folder === "all" ? "No documents yet. Upload the first agreement." : "Nothing in this folder yet."}
          />
        </div>
      </div>

      <FolderDialog open={newFolder} onOpenChange={setNewFolder} />
      <UploadDialog
        open={upload}
        onOpenChange={setUpload}
        folders={folders}
        targets={targets}
        initial={folder !== "all" && folder !== "none" ? { folder_id: folder } : undefined}
      />
    </div>
  );
}

function FolderDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [name, setName] = useState("");
  const [pending, start] = useTransition();
  return (
    <Dialog open={open} onOpenChange={(o) => (onOpenChange(o), !o && setName(""))}>
      <DialogContent className="max-w-sm">
        <DialogTitle>New folder</DialogTitle>
        <form
          className="mt-4 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await createFolderAction(name, null);
              if (!r.ok) return void toast.error(r.error);
              toast.success("Folder created");
              onOpenChange(false);
              setName("");
            });
          }}
        >
          <FormField label="Name" htmlFor="folder-name">
            <Input id="folder-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus />
          </FormField>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || name.trim().length < 2}>
              Create
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
