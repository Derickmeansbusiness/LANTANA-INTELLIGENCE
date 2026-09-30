import "server-only";
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { Block } from "@/lib/templates/types";
import { base, CHARCOAL, Footer, GOLD, GOLD_SOFT, Letterhead, MUTED, pdfText } from "@/server/pdf/letterhead";

const s = StyleSheet.create({
  page: { ...base.page, fontSize: 10, paddingBottom: 64 },
  draft: { position: "absolute", top: 10, right: 40, fontSize: 7, letterSpacing: 1.5, color: GOLD },
  title: { fontFamily: "Times-Roman", fontSize: 17, textAlign: "center", marginTop: 4, marginBottom: 2 },
  sub: { textAlign: "center", color: MUTED, fontSize: 10, marginBottom: 12 },
  metaRow: { flexDirection: "row", marginBottom: 2 },
  metaLabel: { width: 80, color: MUTED },
  metaValue: { flex: 1 },
  heading: { fontFamily: "Helvetica-Bold", fontSize: 10.5, marginTop: 10, marginBottom: 4 },
  para: { fontSize: 10, lineHeight: 1.45, marginBottom: 7 },
  clause: { fontSize: 10, lineHeight: 1.45, marginBottom: 7 },
  bold: { fontFamily: "Helvetica-Bold" },
  li: { flexDirection: "row", marginBottom: 3, fontSize: 10, lineHeight: 1.4 },
  bullet: { width: 16, color: GOLD_SOFT },
  table: { marginVertical: 8, borderTopWidth: 0.75, borderTopColor: GOLD },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#d9d4cc", paddingVertical: 5 },
  th: { fontFamily: "Helvetica-Bold", fontSize: 9, color: MUTED },
  note: { marginTop: 10, padding: 8, backgroundColor: "#f6f1e6", fontSize: 8.5, color: CHARCOAL, lineHeight: 1.4 },
  sigs: { flexDirection: "row", flexWrap: "wrap", gap: 24, marginTop: 22 },
  sig: { width: 220 },
  sigLine: { borderBottomWidth: 0.75, borderBottomColor: CHARCOAL, height: 36, marginBottom: 4 },
  small: { fontSize: 8.5, color: MUTED, marginTop: 2 },
});

function renderBlock(b: Block, i: number) {
  switch (b.kind) {
    case "title":
      return (
        <View key={i} wrap={false}>
          <Text style={s.title}>{pdfText(b.text)}</Text>
          {b.sub ? <Text style={s.sub}>{pdfText(b.sub)}</Text> : <View style={{ height: 10 }} />}
        </View>
      );
    case "meta":
      return (
        <View key={i} style={{ marginBottom: 10 }}>
          {b.rows.map(([k, v]) => (
            <View key={k} style={s.metaRow}>
              <Text style={s.metaLabel}>{pdfText(k)}</Text>
              <Text style={s.metaValue}>{pdfText(v)}</Text>
            </View>
          ))}
        </View>
      );
    case "heading":
      return (
        <Text key={i} style={s.heading} minPresenceAhead={40}>
          {pdfText(b.text)}
        </Text>
      );
    case "para":
      return (
        <Text key={i} style={s.para}>
          {pdfText(b.text)}
        </Text>
      );
    case "clause":
      return (
        <Text key={i} style={s.clause}>
          <Text style={s.bold}>{pdfText(`${b.n}. ${b.title}. `)}</Text>
          {pdfText(b.text)}
        </Text>
      );
    case "list":
      return (
        <View key={i} style={{ marginBottom: 6 }}>
          {b.items.map((it, j) => (
            <View key={j} style={s.li}>
              <Text style={s.bullet}>{b.numbered ? `${j + 1}.` : "•"}</Text>
              <Text style={{ flex: 1 }}>{pdfText(it)}</Text>
            </View>
          ))}
        </View>
      );
    case "table":
      return (
        <View key={i} style={s.table}>
          <View style={s.tr}>
            {b.head.map((h, j) => (
              <Text key={j} style={[s.th, { flex: j === 0 ? 3 : 1, textAlign: b.align?.[j] ?? "left" }]}>
                {pdfText(h)}
              </Text>
            ))}
          </View>
          {b.rows.map((r, ri) => (
            <View key={ri} style={s.tr}>
              {r.map((c, j) => (
                <Text key={j} style={[{ flex: j === 0 ? 3 : 1, textAlign: b.align?.[j] ?? "left" }, ri === b.rows.length - 1 ? s.bold : {}]}>
                  {pdfText(c)}
                </Text>
              ))}
            </View>
          ))}
        </View>
      );
    case "note":
      return (
        <Text key={i} style={s.note}>
          {pdfText(b.text)}
        </Text>
      );
    case "signatures":
      return (
        <View key={i} style={s.sigs} wrap={false}>
          {b.parties.map((p, j) => (
            <View key={j} style={s.sig}>
              <Text style={s.bold}>{pdfText(p.heading)}</Text>
              <View style={s.sigLine} />
              <Text>{pdfText(p.name || "Name:")}</Text>
              <Text style={s.small}>{pdfText(p.title || "Title:")}</Text>
              <Text style={s.small}>Date:</Text>
            </View>
          ))}
        </View>
      );
  }
}

export async function renderTemplatePdf(opts: { title: string; blocks: Block[]; address: string[]; draft: boolean }) {
  const doc = (
    <Document title={pdfText(opts.title)} author="Lantana Vision FZ-LLC" creator="Lantana Command" producer="Lantana Command">
      <Page size="A4" style={s.page}>
        {opts.draft && (
          <Text style={s.draft} fixed>
            DRAFT FOR REVIEW
          </Text>
        )}
        <Letterhead address={opts.address} />
        {opts.blocks.map(renderBlock)}
        <Footer />
      </Page>
    </Document>
  );
  return renderToBuffer(doc);
}
