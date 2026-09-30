// Shared by @react-pdf templates and the pdf-lib watermark.

const REPLACEMENTS: [RegExp, string][] = [
  [/↔/g, "<->"],
  [/→/g, "->"],
  [/₦/g, "NGN "],
  [/[  ]/g, " "],
];

/** Keep text inside the WinAnsi set the standard PDF fonts can draw. */
export function pdfText(s: string | null | undefined) {
  let out = s ?? "";
  for (const [re, rep] of REPLACEMENTS) out = out.replace(re, rep);
  return out.replace(/[^\u0009\u000A\u000D -~ -ÿ–—‘’“”•…€]/g, "?");
}
