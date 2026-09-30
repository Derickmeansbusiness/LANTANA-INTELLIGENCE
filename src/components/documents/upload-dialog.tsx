"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileUpIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/form-field";
import { createClient } from "@/lib/supabase/client";
import { safeFileName } from "@/lib/schemas/documents";
import { cn } from "@/lib/utils";
import { createDocumentAction, registerVersionAction } from "@/server/actions/documents";
import type { LinkTarget } from "@/server/documents";
import { DocMetaFields, EMPTY_META, metaPayload, type DocMeta } from "./meta-fields";

const MAX = 50 * 1024 * 1024;
const ACCEPT = ".pdf,.docx,.xlsx,.csv,.txt,.md,.png,.jpg,.jpeg,.pptx,.doc,.xls";

export function fmtSize(n: number | null | undefined) {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

async function sha256(file: File) {
  const buf = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Browser → storage (under the user's session, storage RLS applies) → register the version. */
async function uploadVersion(documentId: string, file: File, note: string) {
  const path = `${documentId}/${crypto.randomUUID()}/${safeFileName(file.name)}`;
  const supabase = createClient();
  const { error } = await supabase.storage.from("documents").upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (error) return { ok: false as const, error: error.message.includes("row-level security") ? "You can't add files to this document." : "Upload failed. Try again." };
  return registerVersionAction({
    documentId,
    storagePath: path,
    fileName: file.name.slice(0, 200),
    mimeType: file.type || null,
    sizeBytes: file.size,
    sha256: await sha256(file),
    note,
  });
}

export function UploadDialog({
  open,
  onOpenChange,
  documentId,
  folders = [],
  targets = [],
  initial,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Set: upload a new version of this document. Unset: create a new document. */
  documentId?: string;
  folders?: { id: string; name: string }[];
  targets?: LinkTarget[];
  initial?: Partial<DocMeta>;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [note, setNote] = useState("");
  const [v, setV] = useState<DocMeta>({ ...EMPTY_META, ...initial });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const set = <K extends keyof DocMeta>(k: K, val: DocMeta[K]) => setV((s) => ({ ...s, [k]: val }));

  function pick(f: File | undefined) {
    if (!f) return;
    if (f.size > MAX) return void toast.error("Files are limited to 50 MB.");
    setFile(f);
    if (!documentId && !v.title) set("title", f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim());
  }

  function reset() {
    setFile(null);
    setNote("");
    setErrors({});
    setV({ ...EMPTY_META, ...initial });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (onOpenChange(o), !o && reset())}>
      <DialogContent className="top-[5vh] max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogTitle>{documentId ? "Upload a new version" : "Upload a document"}</DialogTitle>
        <DialogDescription className="mt-1">
          {documentId
            ? "The new file becomes the current version. Earlier versions stay on file."
            : "The file is stored privately. Its text is extracted so you can search inside it."}
        </DialogDescription>
        <form
          noValidate
          className="mt-5 grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!file) return void toast.error("Choose a file first.");
            start(async () => {
              let id = documentId;
              if (!id) {
                const r = await createDocumentAction(metaPayload(v));
                if (!r.ok) {
                  setErrors(r.fieldErrors ?? {});
                  return void toast.error(r.error);
                }
                id = r.data.id;
              }
              const up = await uploadVersion(id, file, note);
              if (!up.ok) {
                toast.error(documentId ? up.error : `Document saved, but the file didn't upload: ${up.error} Retry from the document page.`);
                if (!documentId) router.push(`/documents/${id}`);
                return;
              }
              toast.success(`Version ${up.data.versionNo} uploaded. Text extraction is running.`);
              onOpenChange(false);
              reset();
              if (documentId) router.refresh();
              else router.push(`/documents/${id}`);
            });
          }}
        >
          <div
            role="button"
            tabIndex={0}
            aria-label="Choose a file or drop it here"
            onClick={() => input.current?.click()}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), input.current?.click())}
            onDragOver={(e) => (e.preventDefault(), setDrag(true))}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              pick(e.dataTransfer.files[0]);
            }}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-center text-sm transition-colors sm:col-span-2",
              drag ? "border-gold bg-gold-wash" : "hover:border-gold/60 hover:bg-surface-2",
            )}
          >
            <FileUpIcon className="size-6 text-gold" />
            {file ? (
              <span className="min-w-0 break-all">
                <span className="font-medium">{file.name}</span> <span className="num text-muted-foreground">· {fmtSize(file.size)}</span>
              </span>
            ) : (
              <>
                <span className="font-medium">Drop a file here or click to choose</span>
                <span className="text-xs text-muted-foreground">PDF, Word, Excel, CSV, text or images · up to 50 MB</span>
              </>
            )}
            <input ref={input} type="file" accept={ACCEPT} className="sr-only" data-testid="upload-input" onChange={(e) => pick(e.target.files?.[0])} />
          </div>

          {documentId ? (
            <FormField label="What changed?" htmlFor="ver-note" className="sm:col-span-2" hint="Optional. Shown in the version history.">
              <Input id="ver-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
            </FormField>
          ) : (
            <DocMetaFields v={v} set={set} errors={errors} folders={folders} targets={targets} idPrefix="up" />
          )}

          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !file}>
              {pending && <Loader2Icon className="animate-spin" />} Upload
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
