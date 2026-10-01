import "server-only";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  ImageRun,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TabStopType,
  TextRun,
  WidthType,
} from "docx";
import type { Block } from "@/lib/templates/types";
import { MARK_PNG_BASE64 } from "./assets/mark-png";

// The traced logo mark as PNG (Word can't take the SVG paths directly).
const MARK_PNG = Buffer.from(MARK_PNG_BASE64, "base64");

// Same palette as the PDF letterhead, without the leading '#'.
const GOLD = "D4A045";
const MUTED = "6B6570";
const CHARCOAL = "2F2A32";
const FONT = "Calibri";
const NONE = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const NO_BORDERS = { top: NONE, bottom: NONE, left: NONE, right: NONE, insideHorizontal: NONE, insideVertical: NONE };

const run = (text: string, o: { bold?: boolean; size?: number; color?: string; font?: string } = {}) =>
  new TextRun({ text, bold: o.bold, size: o.size ?? 21, color: o.color ?? CHARCOAL, font: o.font ?? FONT });

const p = (children: TextRun[], o: { after?: number; before?: number; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; indent?: number } = {}) =>
  new Paragraph({ children, spacing: { after: o.after ?? 140, before: o.before ?? 0, line: 300 }, alignment: o.align, indent: o.indent ? { left: o.indent, hanging: 360 } : undefined });

function blockToDocx(b: Block): (Paragraph | Table)[] {
  switch (b.kind) {
    case "title":
      return [
        p([run(b.text, { size: 34, font: "Georgia" })], { align: AlignmentType.CENTER, before: 120, after: b.sub ? 40 : 240 }),
        ...(b.sub ? [p([run(b.sub, { color: MUTED })], { align: AlignmentType.CENTER, after: 240 })] : []),
      ];
    case "meta":
      return b.rows.map(([k, v]) =>
        new Paragraph({ tabStops: [{ type: TabStopType.LEFT, position: 1600 }], spacing: { after: 40 }, children: [run(k, { color: MUTED }), new TextRun({ text: "\t" }), run(v)] }),
      ).concat(p([], { after: 120 }));
    case "heading":
      return [p([run(b.text, { bold: true, size: 22 })], { before: 200, after: 80 })];
    case "para":
      return [p([run(b.text)])];
    case "clause":
      return [p([run(`${b.n}. ${b.title}. `, { bold: true }), run(b.text)])];
    case "list":
      return b.items.map((it, j) => p([run(`${b.numbered ? `${j + 1}.` : "•"}\t`, { color: b.numbered ? CHARCOAL : GOLD }), run(it)], { after: 60, indent: 360 }));
    case "note":
      return [
        new Paragraph({
          shading: { type: ShadingType.CLEAR, color: "auto", fill: "F6F1E6" },
          spacing: { before: 200, after: 140, line: 280 },
          children: [run(b.text, { size: 18 })],
        }),
      ];
    case "table":
      return [
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: { ...NO_BORDERS, top: { style: BorderStyle.SINGLE, size: 8, color: GOLD }, insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: "D9D4CC" }, bottom: { style: BorderStyle.SINGLE, size: 4, color: "D9D4CC" } },
          rows: [b.head, ...b.rows].map(
            (r, ri) =>
              new TableRow({
                children: r.map(
                  (c, j) =>
                    new TableCell({
                      width: { size: j === 0 ? 75 : 25, type: WidthType.PERCENTAGE },
                      margins: { top: 80, bottom: 80 },
                      children: [
                        new Paragraph({
                          alignment: b.align?.[j] === "right" ? AlignmentType.RIGHT : AlignmentType.LEFT,
                          children: [run(c, { bold: ri === 0 || ri === b.rows.length, color: ri === 0 ? MUTED : CHARCOAL, size: ri === 0 ? 18 : 21 })],
                        }),
                      ],
                    }),
                ),
              }),
          ),
        }),
        p([], { after: 120 }),
      ];
    case "signatures": {
      const cols = Math.min(2, b.parties.length) || 1;
      const rows: TableRow[] = [];
      for (let i = 0; i < b.parties.length; i += cols) {
        const slice = b.parties.slice(i, i + cols);
        rows.push(
          new TableRow({
            children: slice.map(
              (party) =>
                new TableCell({
                  width: { size: 100 / cols, type: WidthType.PERCENTAGE },
                  margins: { right: 400, bottom: 300 },
                  children: [
                    p([run(party.heading, { bold: true })], { after: 480 }),
                    new Paragraph({ border: { top: { style: BorderStyle.SINGLE, size: 6, color: CHARCOAL, space: 4 } }, children: [run(party.name || "Name:")] }),
                    p([run(party.title || "Title:", { color: MUTED, size: 18 })], { after: 20 }),
                    p([run("Date:", { color: MUTED, size: 18 })]),
                  ],
                }),
            ),
          }),
        );
      }
      return [p([], { after: 240 }), new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: NO_BORDERS, rows })];
    }
  }
}

export async function renderTemplateDocx(opts: { title: string; blocks: Block[]; address: string[]; draft: boolean }) {
  // Two-column borderless table: renders the same in Word, LibreOffice and docx-preview.
  const header = new Header({
    children: [
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: NO_BORDERS,
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({
                    children: [
                      new ImageRun({ type: "png", data: MARK_PNG, transformation: { width: 40, height: 40 } }),
                      new TextRun({ text: "  " }),
                      run("LANTANA VISION", { size: 26, font: "Georgia" }),
                    ],
                  }),
                  new Paragraph({ indent: { left: 760 }, children: [run("GROUP", { size: 13, color: GOLD })] }),
                ],
              }),
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                children: opts.address.map((l) => new Paragraph({ alignment: AlignmentType.RIGHT, children: [run(l, { size: 15, color: MUTED })] })),
              }),
            ],
          }),
        ],
      }),
      new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: GOLD, space: 1 } },
        alignment: AlignmentType.RIGHT,
        spacing: { after: 240 },
        children: opts.draft ? [run("DRAFT FOR REVIEW", { size: 14, color: GOLD })] : [],
      }),
    ],
  });
  const footer = new Footer({
    children: [
      new Paragraph({
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: "B08D57", space: 4 } },
        tabStops: [{ type: TabStopType.RIGHT, position: 9000 }],
        children: [
          run("Lantana Vision FZ-LLC • Ras Al Khaimah, UAE • info@lantanavision.com • www.lantanavision.com", { size: 14, color: MUTED }),
          new TextRun({ text: "\t" }),
          new TextRun({ children: ["Page ", PageNumber.CURRENT, " of ", PageNumber.TOTAL_PAGES], size: 14, color: MUTED, font: FONT }),
        ],
      }),
    ],
  });

  const doc = new Document({
    creator: "Lantana Command",
    title: opts.title,
    styles: { default: { document: { run: { font: FONT, size: 21 } } } },
    sections: [
      {
        properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1300, bottom: 1200, left: 1134, right: 1134, header: 500, footer: 500 } } },
        headers: { default: header },
        footers: { default: footer },
        children: opts.blocks.flatMap(blockToDocx),
      },
    ],
  });
  return Packer.toBuffer(doc);
}
