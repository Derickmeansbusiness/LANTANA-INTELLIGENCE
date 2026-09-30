import "server-only";
import { degrees, PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { pdfText } from "@/server/pdf/text";

/**
 * Stamp every page of a shared file with who it was shared with and when.
 * A diagonal mark across the page (hard to crop out) plus a plain footer line
 * (readable when printed). Images are wrapped in a one-page PDF first, so the
 * recipient never receives an unmarked original.
 */
export async function watermark(buf: Uint8Array, mime: string, lines: { recipient: string; stamp: string; title: string }) {
  let pdf: PDFDocument;
  if (mime === "application/pdf") {
    pdf = await PDFDocument.load(buf, { ignoreEncryption: false, updateMetadata: false });
  } else {
    pdf = await PDFDocument.create();
    const img = mime === "image/png" ? await pdf.embedPng(buf) : await pdf.embedJpg(buf);
    // Fit on A4 portrait with a margin, keeping the aspect ratio.
    const [W, H, M] = [595.28, 841.89, 36];
    const scale = Math.min((W - 2 * M) / img.width, (H - 2 * M - 24) / img.height, 1);
    const page = pdf.addPage([W, H]);
    page.drawImage(img, { x: (W - img.width * scale) / 2, y: H - M - img.height * scale, width: img.width * scale, height: img.height * scale });
  }

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const diag = pdfText(`Shared with ${lines.recipient}`);
  const foot = pdfText(`Lantana Vision FZ-LLC · Confidential · shared with ${lines.recipient} · ${lines.stamp} · do not forward`);

  for (const page of pdf.getPages()) {
    const { width, height } = page.getSize();
    const size = Math.min(width, height) / 14;
    const tw = bold.widthOfTextAtSize(diag, size);
    const angle = Math.atan2(height, width);
    page.drawText(diag, {
      x: width / 2 - (tw / 2) * Math.cos(angle),
      y: height / 2 - (tw / 2) * Math.sin(angle),
      size,
      font: bold,
      color: rgb(0.83, 0.63, 0.27),
      opacity: 0.16,
      rotate: degrees((angle * 180) / Math.PI),
    });
    const fs = 7;
    const fw = font.widthOfTextAtSize(foot, fs);
    page.drawText(foot, { x: Math.max(12, (width - fw) / 2), y: 12, size: fs, font, color: rgb(0.42, 0.4, 0.44), opacity: 0.9 });
  }
  pdf.setTitle(pdfText(lines.title));
  pdf.setProducer("Lantana Command");
  return pdf.save();
}
