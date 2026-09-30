"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArchiveIcon, ArchiveRestoreIcon, DownloadIcon, Loader2Icon, LockIcon, LockOpenIcon, MoreHorizontalIcon, PencilIcon, RotateCwIcon, UploadIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  reingestVersionAction,
  setCheckoutAction,
  setDocumentArchivedAction,
  updateDocumentAction,
  versionUrlAction,
} from "@/server/actions/documents";
import type { LinkTarget } from "@/server/documents";
import { DocMetaFields, metaPayload, type DocMeta } from "./meta-fields";
import { UploadDialog } from "./upload-dialog";

export async function openVersion(versionId: string, mode: "view" | "download") {
  const r = await versionUrlAction(versionId, mode);
  if (!r.ok) return void toast.error(r.error);
  if (mode === "download") window.location.assign(r.data.url);
  else window.open(r.data.url, "_blank", "noopener,noreferrer");
}

export function DocumentActions({
  docId,
  currentVersionId,
  initial,
  folders,
  targets,
  canEdit,
  canManage,
  lockedByMe,
  lockedByOther,
  archived,
}: {
  docId: string;
  currentVersionId: string | null;
  initial: DocMeta;
  folders: { id: string; name: string }[];
  targets: LinkTarget[];
  canEdit: boolean;
  canManage: boolean;
  lockedByMe: boolean;
  lockedByOther: string | null;
  archived: boolean;
}) {
  const router = useRouter();
  const [edit, setEdit] = useState(false);
  const [upload, setUpload] = useState(false);
  const [pending, start] = useTransition();
  const [v, setV] = useState<DocMeta>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof DocMeta>(k: K, val: DocMeta[K]) => setV((s) => ({ ...s, [k]: val }));
  const canWrite = canEdit && !lockedByOther && !archived;

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error ?? "Something went wrong");
      toast.success(msg);
      router.refresh();
    });

  return (
    <>
      {currentVersionId && (
        <Button variant="outline" size="sm" onClick={() => openVersion(currentVersionId, "download")}>
          <DownloadIcon /> Download
        </Button>
      )}
      {canWrite && (
        <Button size="sm" onClick={() => setUpload(true)}>
          <UploadIcon /> {currentVersionId ? "New version" : "Upload file"}
        </Button>
      )}
      {(canEdit || canManage) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" aria-label="More actions" disabled={pending}>
              {pending ? <Loader2Icon className="animate-spin" /> : <MoreHorizontalIcon />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {canWrite && (
              <DropdownMenuItem onSelect={() => (setV(initial), setEdit(true))}>
                <PencilIcon /> Edit details
              </DropdownMenuItem>
            )}
            {canEdit && !archived && !lockedByMe && !lockedByOther && (
              <DropdownMenuItem onSelect={() => run(() => setCheckoutAction(docId, true), "Checked out. Others can't upload until you check it in.")}>
                <LockIcon /> Check out
              </DropdownMenuItem>
            )}
            {(lockedByMe || (lockedByOther && canManage)) && (
              <DropdownMenuItem onSelect={() => run(() => setCheckoutAction(docId, false), "Checked in")}>
                <LockOpenIcon /> Check in{lockedByOther ? ` (${lockedByOther})` : ""}
              </DropdownMenuItem>
            )}
            {canManage && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => run(() => setDocumentArchivedAction(docId, !archived), archived ? "Restored" : "Archived")}>
                  {archived ? <ArchiveRestoreIcon /> : <ArchiveIcon />} {archived ? "Restore" : "Archive"}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <Dialog open={edit} onOpenChange={(o) => (setEdit(o), !o && setErrors({}))}>
        <DialogContent className="top-[5vh] max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogTitle>Edit document</DialogTitle>
          <DialogDescription className="mt-1">Changing confidentiality changes who can open the file. Every change is audited.</DialogDescription>
          <form
            noValidate
            className="mt-5 grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const r = await updateDocumentAction(docId, metaPayload(v));
                if (!r.ok) {
                  setErrors(r.fieldErrors ?? {});
                  return void toast.error(r.error);
                }
                toast.success("Document updated");
                setEdit(false);
                router.refresh();
              });
            }}
          >
            <DocMetaFields v={v} set={set} errors={errors} folders={folders} targets={targets} idPrefix="edit" />
            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button type="button" variant="ghost" onClick={() => setEdit(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2Icon className="animate-spin" />} Save
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <UploadDialog open={upload} onOpenChange={setUpload} documentId={docId} />
    </>
  );
}

export function ReingestButton({ docId, versionId }: { docId: string; versionId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await reingestVersionAction(docId, versionId);
          if (!r.ok) toast.error(r.error);
          else toast.success(r.data.status === "done" ? "Text extracted" : r.data.status === "needs_ocr" ? "Still no text layer. OCR isn't configured." : "Done");
          router.refresh();
        })
      }
    >
      {pending ? <Loader2Icon className="animate-spin" /> : <RotateCwIcon />} Re-read
    </Button>
  );
}

export function VersionButtons({ versionId }: { versionId: string }) {
  return (
    <Button variant="ghost" size="sm" aria-label="Download this version" onClick={() => openVersion(versionId, "download")}>
      <DownloadIcon />
    </Button>
  );
}

/** While a version is still being indexed, refresh a few times so its status lands without a reload. */
export function IngestPoller({ pending }: { pending: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!pending) return;
    let n = 0;
    const t = setInterval(() => {
      if (++n > 15) return clearInterval(t);
      router.refresh();
    }, 4000);
    return () => clearInterval(t);
  }, [pending, router]);
  return null;
}
