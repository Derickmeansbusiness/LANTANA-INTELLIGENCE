"use client";

import { useEffect, useRef, useState } from "react";
import { FileIcon, Loader2Icon } from "lucide-react";
import { versionUrlAction } from "@/server/actions/documents";

type Kind = "pdf" | "image" | "docx" | "xlsx" | "text" | "none";

export function previewKind(mime: string | null, fileName: string): Kind {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  if (mime === "application/pdf" || ext === "pdf") return "pdf";
  if (mime?.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif"].includes(ext)) return "image";
  if (ext === "docx") return "docx";
  if (ext === "xlsx") return "xlsx";
  if (mime?.startsWith("text/") || ["txt", "csv", "md"].includes(ext)) return "text";
  return "none";
}

/**
 * Renders one stored version in the browser from a 2-minute signed URL.
 * Opening a preview is logged as a view on the document.
 */
export function Preview({ versionId, mime, fileName }: { versionId: string; mime: string | null; fileName: string }) {
  const kind = previewKind(mime, fileName);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [sheet, setSheet] = useState<{ name: string; rows: string[][] } | null>(null);
  const docxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (kind === "none") return;
    let live = true;
    (async () => {
      const r = await versionUrlAction(versionId, "view");
      if (!live) return;
      if (!r.ok) return setError(r.error);
      setUrl(r.data.url);
      if (kind === "pdf" || kind === "image") return;
      try {
        const res = await fetch(r.data.url);
        if (!res.ok) throw new Error(String(res.status));
        if (kind === "text") {
          const t = await res.text();
          if (live) setText(t.length > 200_000 ? t.slice(0, 200_000) + "\n…" : t);
        } else if (kind === "docx") {
          const buf = await res.arrayBuffer();
          const { renderAsync } = await import("docx-preview");
          if (live && docxRef.current) {
            await renderAsync(buf, docxRef.current, undefined, { inWrapper: true, ignoreWidth: false, breakPages: true, renderHeaders: true, renderFooters: true });
          }
        } else if (kind === "xlsx") {
          const buf = await res.arrayBuffer();
          const ExcelJS = (await import("exceljs")).default;
          const wb = new ExcelJS.Workbook();
          await wb.xlsx.load(buf);
          const ws = wb.worksheets[0];
          const rows: string[][] = [];
          ws?.eachRow({ includeEmpty: false }, (row) => {
            if (rows.length >= 200) return;
            const vals = (row.values as unknown[]).slice(1, 31).map((v) => {
              if (v == null) return "";
              if (typeof v === "object" && v !== null && "result" in v) return String((v as { result: unknown }).result ?? "");
              if (typeof v === "object" && v !== null && "text" in v) return String((v as { text: unknown }).text ?? "");
              if (v instanceof Date) return v.toISOString().slice(0, 10);
              return String(v);
            });
            rows.push(vals);
          });
          if (live) setSheet({ name: ws?.name ?? "Sheet 1", rows });
        }
      } catch {
        if (live) setError("Couldn't render a preview. Download the file instead.");
      }
    })();
    return () => {
      live = false;
    };
  }, [versionId, kind]);

  if (kind === "none") {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
        <FileIcon className="size-8" />
        No in-browser preview for this format. Download it to open.
      </div>
    );
  }
  if (error) return <p className="py-10 text-center text-sm text-muted-foreground">{error}</p>;
  if (!url) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <Loader2Icon className="size-5 animate-spin" aria-label="Loading preview" />
      </div>
    );
  }
  if (kind === "pdf") return <iframe src={url} title={`Preview of ${fileName}`} className="h-[75vh] w-full rounded-md border bg-white" />;
  // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL, not optimisable
  if (kind === "image") return <img src={url} alt={fileName} className="mx-auto max-h-[75vh] rounded-md border" />;
  if (kind === "text") return <pre className="max-h-[75vh] overflow-auto rounded-md border bg-surface-2 p-3 text-xs whitespace-pre-wrap">{text ?? "…"}</pre>;
  if (kind === "xlsx") {
    return sheet ? (
      <div className="max-h-[75vh] overflow-auto rounded-md border">
        <p className="sticky top-0 border-b bg-surface px-3 py-1.5 text-xs text-muted-foreground">
          {sheet.name} · first {sheet.rows.length} rows
        </p>
        <table className="text-xs">
          <tbody>
            {sheet.rows.map((r, i) => (
              <tr key={i} className="border-b last:border-0">
                {r.map((c, j) => (
                  <td key={j} className="num border-r px-2 py-1 whitespace-nowrap last:border-0">
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <Loader2Icon className="size-5 animate-spin" />
      </div>
    );
  }
  return <div ref={docxRef} className="docx-preview max-h-[75vh] overflow-auto rounded-md border bg-white text-black" />;
}
