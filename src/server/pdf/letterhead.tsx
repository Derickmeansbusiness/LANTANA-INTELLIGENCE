import "server-only";
import { Circle, Font, Path, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";

// Never split words: hyphenated names and figures read badly on legal records.
Font.registerHyphenationCallback((word) => [word]);

/**
 * Lantana letterhead for generated PDFs: mark top-left, registered address
 * top-right, gold rule, and the standard footer. Reused by every template.
 * Uses the built-in Helvetica/Times faces (WinAnsi); run text through
 * pdfText() so characters outside that set don't render as blanks.
 */

export const GOLD = "#D4A045";
export const GOLD_SOFT = "#B08D57";
export const CHARCOAL = "#2F2A32";
export const MUTED = "#6B6570";

export const base = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 56, paddingHorizontal: 40, fontFamily: "Helvetica", fontSize: 9, color: CHARCOAL },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  brand: { flexDirection: "row", alignItems: "center", gap: 8 },
  brandName: { fontFamily: "Times-Roman", fontSize: 14, letterSpacing: 1.2 },
  brandSub: { fontSize: 7, letterSpacing: 2, color: MUTED, marginTop: 2 },
  address: { fontSize: 7.5, color: MUTED, textAlign: "right", lineHeight: 1.4 },
  rule: { height: 1.2, backgroundColor: GOLD, marginTop: 12, marginBottom: 16 },
  footer: { position: "absolute", bottom: 22, left: 40, right: 40, flexDirection: "row", justifyContent: "space-between", fontSize: 7, color: MUTED, borderTopWidth: 0.5, borderTopColor: GOLD_SOFT, paddingTop: 6 },
});

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

export function Letterhead({ address }: { address: string[] }) {
  return (
    <View fixed>
      <View style={base.headerRow}>
        <View style={base.brand}>
          <Svg width={26} height={26} viewBox="0 0 32 32">
            <Circle cx="16" cy="16" r="14" stroke={GOLD} strokeWidth={1.75} fill="none" />
            <Path d="M6 20 Q16 6 26 20" stroke={GOLD} strokeWidth={1.75} fill="none" />
          </Svg>
          <View>
            <Text style={base.brandName}>LANTANA VISION</Text>
            <Text style={base.brandSub}>CONSULTING</Text>
          </View>
        </View>
        <View>
          {address.map((l) => (
            <Text key={l} style={base.address}>
              {pdfText(l)}
            </Text>
          ))}
        </View>
      </View>
      <View style={base.rule} />
    </View>
  );
}

export function Footer() {
  return (
    <View style={base.footer} fixed>
      <Text>Lantana Vision FZ-LLC • Ras Al Khaimah, UAE • www.lantanavision.com</Text>
      <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
    </View>
  );
}
