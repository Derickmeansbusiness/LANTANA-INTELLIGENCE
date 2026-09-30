import "server-only";

export type Extraction = {
  text: string;
  pages: number | null;
  /** done: text found · no_text: a scan/image that needs OCR · unsupported: format we don't read */
  status: "done" | "needs_ocr" | "unsupported" | "failed";
  error?: string;
};

const MAX_CHARS = 2_000_000;

export function kindOf(mime: string | null | undefined, fileName: string) {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  const m = (mime ?? "").toLowerCase();
  if (m === "application/pdf" || ext === "pdf") return "pdf";
  if (m.includes("wordprocessingml") || ext === "docx") return "docx";
  if (m.includes("spreadsheetml") || ext === "xlsx") return "xlsx";
  if (m === "text/csv" || ext === "csv") return "csv";
  if (m.startsWith("text/") || ["txt", "md"].includes(ext)) return "text";
  if (m.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif"].includes(ext)) return "image";
  return "other";
}

/** Pull plain text out of a stored file. Never throws. */
export async function extractText(buf: Buffer, mime: string | null, fileName: string): Promise<Extraction> {
  try {
    switch (kindOf(mime, fileName)) {
      case "pdf": {
        const { getDocumentProxy, extractText: pdfText } = await import("unpdf");
        const pdf = await getDocumentProxy(new Uint8Array(buf));
        const { totalPages, text } = await pdfText(pdf, { mergePages: false });
        const joined = (text as string[]).map((t, i) => `[Page ${i + 1}]\n${t.trim()}`).join("\n\n");
        const meaningful = (text as string[]).join("").replace(/\s/g, "").length;
        // Fewer than ~20 characters per page means a scan with no text layer.
        if (meaningful < 20 * Math.max(1, totalPages)) return { text: "", pages: totalPages, status: "needs_ocr" };
        return { text: joined.slice(0, MAX_CHARS), pages: totalPages, status: "done" };
      }
      case "docx": {
        const mammoth = (await import("mammoth")).default;
        const { value } = await mammoth.extractRawText({ buffer: buf });
        return { text: value.slice(0, MAX_CHARS), pages: null, status: value.trim() ? "done" : "failed", error: value.trim() ? undefined : "Empty document" };
      }
      case "xlsx": {
        const ExcelJS = (await import("exceljs")).default;
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(buf as unknown as ArrayBuffer);
        const parts: string[] = [];
        wb.eachSheet((ws) => {
          parts.push(`[Sheet ${ws.name}]`);
          let n = 0;
          ws.eachRow({ includeEmpty: false }, (row) => {
            if (n++ > 5000) return;
            const vals = (row.values as unknown[]).slice(1).map((v) => cellText(v));
            parts.push(vals.join(" | "));
          });
        });
        const text = parts.join("\n");
        return { text: text.slice(0, MAX_CHARS), pages: null, status: "done" };
      }
      case "csv":
      case "text": {
        const text = buf.toString("utf8").replace(/^﻿/, "");
        return { text: text.slice(0, MAX_CHARS), pages: null, status: text.trim() ? "done" : "failed", error: text.trim() ? undefined : "Empty file" };
      }
      case "image":
        return { text: "", pages: 1, status: "needs_ocr" };
      default:
        return { text: "", pages: null, status: "unsupported" };
    }
  } catch (e) {
    return { text: "", pages: null, status: "failed", error: e instanceof Error ? e.message.slice(0, 300) : "Unknown error" };
  }
}

function cellText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    const o = v as { text?: string; result?: unknown; richText?: { text: string }[] };
    if (o.richText) return o.richText.map((r) => r.text).join("");
    if (o.text) return o.text;
    if (o.result !== undefined) return String(o.result);
    return "";
  }
  return String(v);
}
