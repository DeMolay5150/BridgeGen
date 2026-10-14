import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { Deck, Slide } from "@/lib/deck/redteam";
import { pdfText as t } from "@/lib/report/pdf-text";
import type { Severity } from "@/lib/simulator/types";

/* On-screen deck, so the dark brand palette (unlike the print summary). */
const C = {
  background: "#020617",
  panel: "#0f172a",
  rule: "#1e293b",
  text: "#f8fafc",
  muted: "#94a3b8",
  metric: "#22d3ee",
  positive: "#34d399",
  caution: "#fbbf24",
  critical: "#fb7185",
};
const TONE: Record<Severity, string> = { positive: C.positive, caution: C.caution, critical: C.critical };

// No lineHeight on the Page: it suppresses the page-number `render` text (see tasks/lessons.md).
const s = StyleSheet.create({
  page: { backgroundColor: C.background, color: C.text, fontFamily: "Helvetica", paddingHorizontal: 44, paddingTop: 30, paddingBottom: 48 },
  wordmark: { color: C.metric, fontSize: 8, letterSpacing: 2.5, fontFamily: "Helvetica-Bold" },
  title: { fontSize: 24, fontFamily: "Helvetica-Bold", marginTop: 14, marginBottom: 18 },
  footer: { position: "absolute", bottom: 20, left: 44, right: 44, flexDirection: "row", justifyContent: "space-between", fontSize: 8, color: C.muted },
  bullet: { flexDirection: "row", marginBottom: 12 },
  bulletMark: { width: 22, color: C.metric, fontSize: 14 },
  bulletText: { flex: 1, fontSize: 14, lineHeight: 1.4 },
  cell: { flex: 1, fontSize: 9.5, paddingVertical: 6, paddingHorizontal: 5, lineHeight: 1.3 },
});

function Footer() {
  return (
    <View style={s.footer} fixed>
      <Text>Confidential</Text>
      <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );
}

function SlidePage({ slide }: { slide: Slide }) {
  return (
    <Page size="LETTER" orientation="landscape" style={s.page}>
      <Text style={s.wordmark}>BRIDGEGEN</Text>
      {slide.kind === "title" ? (
        <View style={{ marginTop: 120 }}>
          <Text style={{ color: C.critical, fontSize: 11, letterSpacing: 2, fontFamily: "Helvetica-Bold" }}>{slide.title.toUpperCase()}</Text>
          <Text style={{ fontSize: 34, fontFamily: "Helvetica-Bold", marginTop: 10, lineHeight: 1.2 }}>{t(slide.subtitle)}</Text>
          {slide.meta.map((line) => (
            <Text key={line} style={{ color: C.muted, fontSize: 12, marginTop: 8 }}>
              {t(line)}
            </Text>
          ))}
        </View>
      ) : (
        <Text style={s.title}>{slide.title}</Text>
      )}

      {slide.kind === "headline" && (
        <View style={{ marginTop: 40 }}>
          <Text style={{ borderLeftWidth: 3, borderLeftColor: TONE[slide.tone], paddingLeft: 14, fontSize: 18, lineHeight: 1.4 }}>{t(slide.headline)}</Text>
          <View style={{ flexDirection: "row", gap: 14, marginTop: 36 }}>
            {slide.kpis.map((k) => (
              <View key={k.label} style={{ flex: 1, backgroundColor: C.panel, borderWidth: 1, borderColor: C.rule, borderRadius: 6, padding: 16 }}>
                <Text style={{ color: C.muted, fontSize: 10 }}>{k.label}</Text>
                <Text style={{ color: k.tone ? TONE[k.tone] : C.metric, fontSize: 24, fontFamily: "Helvetica-Bold", marginTop: 6 }}>{t(k.value)}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {slide.kind === "bullets" &&
        slide.bullets.map((b, i) => (
          <View key={b} style={s.bullet} wrap={false}>
            <Text style={s.bulletMark}>{slide.numbered ? `${i + 1}.` : "•"}</Text>
            <Text style={s.bulletText}>{t(b)}</Text>
          </View>
        ))}

      {slide.kind === "table" && (
        <View>
          <View style={{ flexDirection: "row", backgroundColor: C.panel, borderBottomWidth: 1, borderColor: C.rule }}>
            {slide.columns.map((c, i) => (
              <Text key={c} style={[s.cell, { flex: slide.widths[i], color: C.muted, fontFamily: "Helvetica-Bold" }]}>
                {c}
              </Text>
            ))}
          </View>
          {slide.rows.map((row) => (
            <View key={row.cells[0]} style={{ flexDirection: "row", borderBottomWidth: 1, borderColor: C.rule }} wrap={false}>
              {row.cells.map((cell, i) => (
                <Text
                  key={`${i}-${cell}`}
                  style={[s.cell, { flex: slide.widths[i] }, i === 2 && row.tone ? { color: TONE[row.tone], fontFamily: "Helvetica-Bold" } : {}]}
                >
                  {t(cell)}
                </Text>
              ))}
            </View>
          ))}
          {slide.note && <Text style={{ color: C.muted, fontSize: 10, marginTop: 12 }}>{t(slide.note)}</Text>}
        </View>
      )}
      <Footer />
    </Page>
  );
}

/** The Red Team deck as a landscape, slide-per-page PDF. */
export function DeckDocument({ deck }: { deck: Deck }) {
  return (
    <Document title={deck.title} author="BridgeGen" creator="BridgeGen" producer="BridgeGen">
      {deck.slides.map((slide) => (
        <SlidePage key={slide.title} slide={slide} />
      ))}
    </Document>
  );
}
