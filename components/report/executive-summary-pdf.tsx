import type { ReactNode } from "react";
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ExecutiveBrief } from "@/lib/narrative/types";
import type { ReportData } from "@/lib/report/build";
import { pdfText as t } from "@/lib/report/pdf-text";
import type { Severity } from "@/lib/simulator/types";

/*
 * Print palette: the app's signal colours one step darker so they hold on
 * white paper, with the slate-950 brand band on the cover. Loaded only via
 * dynamic import from the export dialog, so react-pdf stays out of the
 * main bundle.
 */
const C = {
  ink: "#0f172a",
  muted: "#64748b",
  rule: "#e2e8f0",
  band: "#020617",
  metric: "#0891b2",
  positive: "#059669",
  caution: "#d97706",
  critical: "#e11d48",
};

const TONE: Record<Severity, string> = { positive: C.positive, caution: C.caution, critical: C.critical };
const VERDICT_LABEL = { survives: "Survives", strained: "Strained", breaks: "Breaks" } as const;
const VERDICT_TONE = { survives: C.positive, strained: C.caution, breaks: C.critical } as const;

// No lineHeight on the Page: react-pdf renders nothing for the footer's page-number
// `render` text when it inherits one, so multi-line styles set their own.
const s = StyleSheet.create({
  page: { paddingTop: 48, paddingBottom: 64, paddingHorizontal: 48, fontFamily: "Helvetica", fontSize: 9.5, color: C.ink },
  band: { backgroundColor: C.band, marginTop: -48, marginHorizontal: -48, paddingHorizontal: 48, paddingTop: 40, paddingBottom: 32, marginBottom: 28 },
  wordmark: { color: "#22d3ee", fontSize: 9, letterSpacing: 3, fontFamily: "Helvetica-Bold" },
  tagline: { color: "#94a3b8", fontSize: 8.5, marginTop: 4 },
  coverTitle: { color: "#ffffff", fontSize: 26, lineHeight: 1.2, fontFamily: "Helvetica-Bold", marginTop: 36 },
  coverCompany: { color: "#e2e8f0", fontSize: 14, lineHeight: 1.3, marginTop: 6 },
  coverMeta: { flexDirection: "row", gap: 24, marginTop: 20 },
  coverMetaLabel: { color: "#64748b", fontSize: 7.5, letterSpacing: 1, textTransform: "uppercase" },
  coverMetaValue: { color: "#e2e8f0", fontSize: 9.5, marginTop: 2 },
  eyebrow: { color: C.metric, fontSize: 7.5, letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "Helvetica-Bold", marginBottom: 4 },
  h1: { fontSize: 17, fontFamily: "Helvetica-Bold", marginBottom: 14 },
  h2: { fontSize: 10.5, fontFamily: "Helvetica-Bold", marginTop: 18, marginBottom: 8 },
  headline: { borderLeftWidth: 2, paddingLeft: 10, fontSize: 11, lineHeight: 1.5, marginBottom: 12 },
  bullet: { flexDirection: "row", marginBottom: 4 },
  bulletMark: { width: 14, color: C.metric },
  bulletText: { flex: 1, lineHeight: 1.45 },
  muted: { color: C.muted, lineHeight: 1.45 },
  kpiStrip: { flexDirection: "row", borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.rule, paddingVertical: 12, marginTop: 8 },
  kpi: { flex: 1 },
  kpiLabel: { color: C.muted, fontSize: 7.5 },
  kpiValue: { color: C.metric, fontSize: 14, fontFamily: "Helvetica-Bold", marginTop: 2 },
  table: { borderTopWidth: 1, borderColor: C.rule },
  row: { flexDirection: "row", borderBottomWidth: 1, borderColor: C.rule, paddingVertical: 5 },
  th: { color: C.muted, fontSize: 7.5, textTransform: "uppercase", letterSpacing: 0.5 },
  cell: { flex: 1 },
  num: { flex: 1, textAlign: "right" },
  wide: { flex: 2.4 },
  pill: { fontSize: 8, fontFamily: "Helvetica-Bold" },
  bar: { height: 4, backgroundColor: C.rule, borderRadius: 2, marginTop: 3 },
  footer: { position: "absolute", bottom: 28, left: 48, right: 48, flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: C.muted, borderTopWidth: 1, borderColor: C.rule, paddingTop: 8 },
  note: { fontSize: 7.5, color: C.muted, marginTop: 18, lineHeight: 1.5 },
});

function Footer({ company }: { company: string }) {
  return (
    <View style={s.footer} fixed>
      <Text>{t(`BridgeGen · Confidential · Prepared for ${company}`)}</Text>
      <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );
}

function Bullets({ items, numbered = false }: { items: string[]; numbered?: boolean }) {
  return (
    <View>
      {items.map((item, i) => (
        <View key={i} style={s.bullet} wrap={false}>
          <Text style={s.bulletMark}>{numbered ? `${i + 1}.` : "•"}</Text>
          <Text style={s.bulletText}>{t(item)}</Text>
        </View>
      ))}
    </View>
  );
}

function Brief({ brief }: { brief: ExecutiveBrief }) {
  return (
    <View>
      <Text style={[s.headline, { borderLeftColor: TONE[brief.tone] }]}>{t(brief.headline)}</Text>
      <Text style={s.h2}>Key findings</Text>
      <Bullets items={brief.findings} />
      {brief.actions.length > 0 && (
        <>
          <Text style={s.h2}>Recommended actions</Text>
          <Bullets items={brief.actions} numbered />
        </>
      )}
    </View>
  );
}

function SectionPage({ eyebrow, title, company, children }: { eyebrow: string; title: string; company: string; children: ReactNode }) {
  return (
    <Page size="LETTER" style={s.page}>
      <Text style={s.eyebrow}>{eyebrow}</Text>
      <Text style={s.h1}>{title}</Text>
      {children}
      <Footer company={company} />
    </Page>
  );
}

function Cover({ r }: { r: ReportData }) {
  return (
    <Page size="LETTER" style={s.page}>
      <View style={s.band}>
        <Text style={s.wordmark}>BRIDGEGEN</Text>
        <Text style={s.tagline}>Private Company Decision Simulator</Text>
        <Text style={s.coverTitle}>Executive Summary</Text>
        <Text style={s.coverCompany}>{t(r.companyName)}</Text>
        <View style={s.coverMeta}>
          <View>
            <Text style={s.coverMetaLabel}>Prepared by</Text>
            <Text style={s.coverMetaValue}>{t(r.preparedBy || "BridgeGen")}</Text>
          </View>
          <View>
            <Text style={s.coverMetaLabel}>Date</Text>
            <Text style={s.coverMetaValue}>{r.dateLabel}</Text>
          </View>
          <View>
            <Text style={s.coverMetaLabel}>Classification</Text>
            <Text style={s.coverMetaValue}>Confidential</Text>
          </View>
        </View>
      </View>

      <Text style={s.eyebrow}>Bottom line</Text>
      {r.bottomLine.map((b) => (
        <View key={b.section} wrap={false}>
          <Text style={[s.muted, { fontSize: 8, marginBottom: 2 }]}>{b.section}</Text>
          <Text style={[s.headline, { borderLeftColor: TONE[b.tone] }]}>{t(b.headline)}</Text>
        </View>
      ))}

      <View style={s.kpiStrip}>
        {r.headlineKpis.map((k) => (
          <View key={k.label} style={s.kpi}>
            <Text style={s.kpiLabel}>{k.label}</Text>
            <Text style={s.kpiValue}>{t(k.value)}</Text>
          </View>
        ))}
      </View>

      <Text style={s.note}>
        {t(
          "All figures are deterministic outputs of the BridgeGen engines for the scenario modelled; no figure is AI-generated. They illustrate consequences under stated assumptions and are not a valuation opinion, fairness opinion or investment advice.",
        )}
      </Text>
      <Footer company={r.companyName} />
    </Page>
  );
}

function CapitalPage({ r }: { r: ReportData }) {
  const c = r.capital;
  return (
    <SectionPage eyebrow="Capital allocation" title="The decision against today" company={r.companyName}>
      <Text style={[s.muted, { marginBottom: 12 }]}>{t(`Scenario: ${c.scenario}`)}</Text>
      <View style={s.table}>
        <View style={s.row}>
          <Text style={[s.th, s.wide]}>Metric</Text>
          <Text style={[s.th, s.num]}>Today</Text>
          <Text style={[s.th, s.num]}>Scenario</Text>
          <Text style={[s.th, s.num]}>Change</Text>
        </View>
        {c.kpis.map((k) => (
          <View key={k.label} style={s.row} wrap={false}>
            <Text style={s.wide}>{k.label}</Text>
            <Text style={[s.num, s.muted]}>{t(k.today)}</Text>
            <Text style={s.num}>{t(k.scenario)}</Text>
            <Text style={[s.num, { color: k.good === null ? C.muted : k.good ? C.positive : C.critical }]}>{t(k.change)}</Text>
          </View>
        ))}
      </View>

      <Text style={s.h2}>Risk signals</Text>
      {c.signals.map((sig) => (
        <View key={sig.id} style={[s.bullet, { marginBottom: 6 }]} wrap={false}>
          <Text style={[s.bulletMark, { color: TONE[sig.severity] }]}>•</Text>
          <View style={s.bulletText}>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>{t(sig.title)}</Text>
            <Text style={s.muted}>{t(sig.detail)}</Text>
          </View>
        </View>
      ))}

      <Text style={s.h2}>{`Economics ${c.economics} / 100 · Alignment ${c.alignment} / 100`}</Text>
      <View style={s.table}>
        {c.stakeholders.map((st) => (
          <View key={st.label} style={s.row} wrap={false}>
            <Text style={s.wide}>{st.label}</Text>
            <View style={[s.cell, { justifyContent: "center" }]}>
              <View style={s.bar}>
                <View style={{ width: `${st.support}%`, height: 4, borderRadius: 2, backgroundColor: st.support >= 65 ? C.positive : st.support >= 40 ? C.caution : C.critical }} />
              </View>
            </View>
            <Text style={s.num}>{`${st.support} support`}</Text>
          </View>
        ))}
      </View>
    </SectionPage>
  );
}

function GovernancePage({ r }: { r: ReportData }) {
  const g = r.governance;
  return (
    <SectionPage eyebrow="Governance debt" title={`Governance Debt Score ${g.score}/100`} company={r.companyName}>
      <Brief brief={g.brief} />
      <Text style={s.h2}>By category</Text>
      <View style={s.table}>
        {g.categories.map((cat) => (
          <View key={cat.label} style={s.row} wrap={false}>
            <Text style={s.wide}>{cat.label}</Text>
            <View style={[s.cell, { justifyContent: "center" }]}>
              <View style={s.bar}>
                <View style={{ width: `${cat.share * 100}%`, height: 4, borderRadius: 2, backgroundColor: cat.share >= 0.6 ? C.critical : cat.share >= 0.3 ? C.caution : C.positive }} />
              </View>
            </View>
            <Text style={s.num}>{`${cat.points} pts`}</Text>
          </View>
        ))}
      </View>
      <Text style={s.note}>{t(`Value at risk: ${g.atRisk}.`)}</Text>
    </SectionPage>
  );
}

function RedTeamPage({ r }: { r: ReportData }) {
  return (
    <SectionPage eyebrow="Red Team stress test" title="Break the plan before reality does" company={r.companyName}>
      <Brief brief={r.redTeam.brief} />
      <Text style={s.h2}>Stress scenarios</Text>
      <View style={s.table}>
        <View style={s.row}>
          <Text style={[s.th, s.wide]}>Scenario</Text>
          <Text style={[s.th, s.cell]}>Verdict</Text>
          <Text style={[s.th, s.num, { flex: 1.8 }]}>Equity</Text>
          <Text style={[s.th, s.num]}>Destroyed</Text>
          <Text style={[s.th, s.num]}>Gov. saving</Text>
        </View>
        {r.redTeam.shocks.map((sh) => (
          <View key={sh.name} style={s.row} wrap={false}>
            <Text style={s.wide}>{sh.name}</Text>
            <Text style={[s.cell, s.pill, { color: VERDICT_TONE[sh.verdict] }]}>{VERDICT_LABEL[sh.verdict]}</Text>
            <Text style={[s.num, { flex: 1.8 }]}>{t(sh.equity)}</Text>
            <Text style={s.num}>{t(sh.valueDestroyed)}</Text>
            <Text style={[s.num, { color: C.positive }]}>{t(sh.governanceSaving)}</Text>
          </View>
        ))}
      </View>
    </SectionPage>
  );
}

function RoomPage({ r }: { r: ReportData }) {
  const room = r.room;
  return (
    <SectionPage eyebrow="Decision Room" title="Where the stakeholders stand" company={r.companyName}>
      <Brief brief={room.brief} />
      {room.disagreements.length > 0 && (
        <>
          <Text style={s.h2}>Disagreements</Text>
          <View style={s.table}>
            {room.disagreements.map((d) => (
              <View key={d.topic} style={s.row} wrap={false}>
                <Text style={[s.wide, { flex: 4 }]}>{t(`“${d.topic}”`)}</Text>
                <Text style={[s.num, { color: TONE[d.severity] }]}>{`${d.spread} pts apart`}</Text>
              </View>
            ))}
          </View>
        </>
      )}
      {room.misperceptions.length > 0 && (
        <>
          <Text style={s.h2}>Misperceptions</Text>
          <View style={s.table}>
            {room.misperceptions.map((m) => (
              <View key={`${m.observer}-${m.target}-${m.topic}`} style={s.row} wrap={false}>
                <Text style={[s.wide, { flex: 4 }]}>{t(`The ${m.observer} misreads the ${m.target} on “${m.topic}”`)}</Text>
                <Text style={[s.num, { color: TONE[m.severity] }]}>{m.severity === "critical" ? "Major" : "Meaningful"}</Text>
              </View>
            ))}
          </View>
        </>
      )}
      <Text style={s.note}>
        {t(
          `${room.submitted} of 4 stakeholders submitted. Individual answers are confidential and are not included in this report: it shows only where views diverge, never who said what.`,
        )}
      </Text>
    </SectionPage>
  );
}

export function ExecutiveSummaryDocument({ report }: { report: ReportData }) {
  const has = (id: ReportData["sections"][number]) => report.sections.includes(id);
  return (
    <Document title={`${report.companyName} — Executive Summary`} author={report.preparedBy || "BridgeGen"} creator="BridgeGen" producer="BridgeGen">
      <Cover r={report} />
      {has("capital") && <CapitalPage r={report} />}
      {has("governance") && <GovernancePage r={report} />}
      {has("redTeam") && <RedTeamPage r={report} />}
      {has("room") && <RoomPage r={report} />}
    </Document>
  );
}
