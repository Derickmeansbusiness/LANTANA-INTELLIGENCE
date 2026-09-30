import "server-only";
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ChainStatus, LedgerRow } from "@/server/ledger";
import { Footer, GOLD_SOFT, Letterhead, MUTED, base, pdfText } from "./letterhead";

const s = StyleSheet.create({
  title: { fontFamily: "Times-Roman", fontSize: 18 },
  meta: { marginTop: 4, color: MUTED, lineHeight: 1.5 },
  box: { marginTop: 12, marginBottom: 14, padding: 8, borderWidth: 0.5, borderColor: GOLD_SOFT, borderRadius: 3, gap: 3 },
  th: { flexDirection: "row", borderBottomWidth: 0.8, borderBottomColor: GOLD_SOFT, paddingBottom: 4, color: MUTED, fontSize: 7.5 },
  tr: { flexDirection: "row", borderBottomWidth: 0.4, borderBottomColor: "#DDD6CA", paddingVertical: 5 },
  c1: { width: "5%" },
  c2: { width: "11%" },
  c3: { width: "24%", paddingRight: 6 },
  c4: { width: "38%", paddingRight: 6 },
  c5: { width: "22%" },
  small: { fontSize: 7, color: MUTED, marginTop: 1.5 },
  mono: { fontFamily: "Courier", fontSize: 6.5, color: MUTED, marginTop: 2 },
});

const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Dubai" });
const fmtTs = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dubai" });
const channel = (c: string) => c.replace(/_/g, " ").replace(/^\w/, (x) => x.toUpperCase());

export function LedgerPdf({
  rows,
  generatedAt,
  generatedBy,
  scope,
  chain,
  address,
}: {
  rows: LedgerRow[];
  generatedAt: string;
  generatedBy: string;
  scope: string;
  chain: ChainStatus | null;
  address: string[];
}) {
  const demo = rows.some((r) => r.is_demo);
  return (
    <Document title="Lantana Vision — Introductions Ledger" author="Lantana Vision FZ-LLC" creator="Lantana Command">
      <Page size="A4" orientation="landscape" style={base.page}>
        <Letterhead address={address} />
        <Text style={s.title}>Introductions Ledger</Text>
        <Text style={s.meta}>
          {pdfText(scope)} · {rows.length} {rows.length === 1 ? "entry" : "entries"} · generated {fmtTs(generatedAt)} (Asia/Dubai) by {pdfText(generatedBy)}
        </Text>
        <View style={s.box}>
          {chain ? (
            <>
              <Text>
                Integrity: {chain.ok ? "VERIFIED" : `BROKEN at entry #${chain.firstBroken}`} — the full ledger ({chain.rows} entries) was re-hashed at export time.
              </Text>
              <Text style={s.mono}>Chain head (SHA-256): {chain.head ?? "empty ledger"}</Text>
            </>
          ) : (
            <Text>Integrity check not included: chain verification is available to managers and principals.</Text>
          )}
          <Text style={s.small}>
            Each entry&apos;s hash covers its own content and the previous entry&apos;s hash, so changing or back-dating any entry changes every hash after it. Entries are never edited; corrections are
            recorded as new entries that reference the original.
            {demo ? " This export includes demo entries, which chain separately from real ones." : ""}
          </Text>
        </View>

        <View style={s.th} fixed>
          <Text style={s.c1}>#</Text>
          <Text style={s.c2}>Date</Text>
          <Text style={s.c3}>Parties</Text>
          <Text style={s.c4}>Introduction</Text>
          <Text style={s.c5}>Recorded</Text>
        </View>
        {rows.map((r) => (
          <View key={r.id} style={s.tr} wrap={false}>
            <Text style={s.c1}>{r.seq}</Text>
            <View style={s.c2}>
              <Text>{fmt(r.introduced_on)}</Text>
              <Text style={s.small}>{channel(r.channel)}</Text>
            </View>
            <View style={s.c3}>
              <Text>{pdfText(r.party_a)}{r.party_a_contact ? ` (${pdfText(r.party_a_contact)})` : ""}</Text>
              <Text style={s.small}>and</Text>
              <Text>{pdfText(r.party_b)}{r.party_b_contact ? ` (${pdfText(r.party_b_contact)})` : ""}</Text>
            </View>
            <View style={s.c4}>
              <Text>{pdfText(r.summary)}</Text>
              {r.deal_name && <Text style={s.small}>Deal: {pdfText(r.deal_name)}</Text>}
              {r.corrects_seq && <Text style={s.small}>Corrects entry #{r.corrects_seq}</Text>}
              {r.is_demo && <Text style={s.small}>Demo entry</Text>}
            </View>
            <View style={s.c5}>
              <Text>{fmtTs(r.recorded_at)}</Text>
              <Text style={s.small}>{pdfText(r.recorded_by ?? "System")}</Text>
              <Text style={s.mono}>{r.row_hash.slice(0, 32)}</Text>
              <Text style={s.mono}>{r.row_hash.slice(32)}</Text>
            </View>
          </View>
        ))}
        <Footer />
      </Page>
    </Document>
  );
}
