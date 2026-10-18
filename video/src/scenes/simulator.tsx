import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { COVERAGE_CAUTION, COVERAGE_CRITICAL } from "../../../lib/simulator/engine";
import { formatMoney, formatMultiple, formatPercent, formatSignedMoney } from "../../../lib/simulator/format";
import type { Severity } from "../../../lib/simulator/types";
import { RECAP_LEVERAGE, baseline, monteCarlo, resultRecap, resultToday, simulateAt, statements, today } from "../data";
import { C, MONO, TONE, wash } from "../theme";
import { Badge, Card, FadeUp, Kpi, Label, Scene, Slider, useProgress } from "../ui";

const coverageTone = (x: number | null): Severity => (x === null || x >= COVERAGE_CAUTION ? "positive" : x >= COVERAGE_CRITICAL ? "caution" : "critical");

/** Shot 1: the demo company at Today. */
export function SimToday() {
  const facts = [
    ["Revenue", formatMoney(baseline.revenue)],
    ["EBITDA", formatMoney(baseline.ebitda)],
    ["Multiple", formatMultiple(baseline.multiple)],
    ["Debt", formatMoney(baseline.existingDebt)],
  ];
  return (
    <Scene eyebrow="Scenario Simulator" title="Start with the client's numbers" caption="Start with the client's numbers, or paste them straight from Excel." captionAt={1}>
      <div style={{ display: "grid", gap: 36 }}>
        <FadeUp delay={0.3} style={{ display: "flex", gap: 20 }}>
          {facts.map(([label, value]) => (
            <Card key={label} style={{ padding: "18px 28px", display: "flex", gap: 18, alignItems: "baseline" }}>
              <Label>{label}</Label>
              <span style={{ fontFamily: MONO, fontSize: 30 }}>{value}</span>
            </Card>
          ))}
        </FadeUp>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 28 }}>
          {[
            ["Enterprise value", formatMoney(resultToday.enterpriseValue)],
            ["Equity value", formatMoney(resultToday.equityValue)],
            ["Interest coverage", formatMultiple(resultToday.interestCoverage)],
            ["Debt / EBITDA", formatMultiple(resultToday.debtToEbitda)],
          ].map(([label, value], i) => (
            <FadeUp key={label} delay={0.6 + i * 0.15}>
              <Kpi label={label} value={value} badge="No change vs. Today" />
            </FadeUp>
          ))}
        </div>
      </div>
    </Scene>
  );
}

/** Shot 2: dragging leverage to 4x; every frame is a real simulate() run. */
export function SimRecap() {
  const p = useProgress(1.2, 6.5);
  const eased = interpolate(p, [0, 1], [0, 1], { easing: Easing.out(Easing.cubic) });
  const leverage = today.leverage + (RECAP_LEVERAGE - today.leverage) * eased;
  const r = simulateAt(leverage);
  const equityDelta = r.equityValue - resultToday.equityValue;
  const coverage = coverageTone(r.interestCoverage);
  const payout = formatMoney(resultRecap.netDistribution);
  return (
    <Scene
      eyebrow="Scenario Simulator"
      title="A 4x dividend recap"
      caption={`A four-times dividend recap pays the family ${payout} today. Watch what it costs.`}
      captionAt={6.5}
    >
      <div style={{ display: "grid", gridTemplateColumns: "560px 1fr", gap: 40, alignItems: "start" }}>
        <FadeUp delay={0.2}>
          <Card style={{ display: "grid", gap: 28 }}>
            <Label>Decision levers</Label>
            <Slider label="Debt leverage" display={formatMultiple(leverage)} fraction={leverage / 6} />
            <Slider label="Equity transfer" display="0%" fraction={0} />
            <Slider label="Multiple shock" display="0%" fraction={0.5} />
          </Card>
        </FadeUp>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28 }}>
          <Kpi
            label="Equity value"
            value={formatMoney(r.equityValue)}
            badge={Math.abs(equityDelta) < 0.05 ? "No change vs. Today" : `${formatSignedMoney(equityDelta)} vs. Today`}
            badgeTone={equityDelta < -0.05 ? "critical" : "neutral"}
          />
          <Kpi label="Recap payout to shareholders" value={formatMoney(Math.max(r.netDistribution, 0))} />
          <Kpi label="Interest coverage" value={formatMultiple(r.interestCoverage)} tone={TONE[coverage]} badge={coverage === "positive" ? "Comfortable" : coverage === "caution" ? "Thin" : "Breach"} badgeTone={coverage} />
          <Kpi label="Debt / EBITDA" value={formatMultiple(r.debtToEbitda)} />
        </div>
      </div>
    </Scene>
  );
}

/** Shot 3: cash-flow statement with revolver draws, and the Monte Carlo range. */
export function Statements() {
  const years = statements.years.slice(1, 6);
  const rows: { label: string; value: (y: (typeof years)[number]) => number; flag?: boolean }[] = [
    { label: "Free cash flow", value: (y) => y.freeCashFlow },
    { label: "Scheduled repayment", value: (y) => -y.mandatoryRepayment },
    { label: "Revolver draw", value: (y) => y.revolverDraw, flag: true },
    { label: "Debt (year end)", value: (y) => y.debt },
  ];
  const peak = Math.max(...monteCarlo.histogram.map((b) => b.count));
  const grow = useProgress(2, 5);
  const highlight = useProgress(1.5, 2.2);
  const { p10, p50, p90 } = monteCarlo.equityValue;
  const horizon = monteCarlo.settings.horizon;
  return (
    <Scene
      eyebrow="Three-statement model"
      title="Linked statements, a thousand paths"
      caption="Linked statements show where free cash flow trails scheduled repayments, and a thousand simulated paths put a probability on breaching covenants."
      captionAt={5}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 640px", gap: 36 }}>
        <FadeUp delay={0.2}>
          <Card>
            <Label style={{ marginBottom: 20 }}>Cash flow · $M</Label>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 26 }}>
              <thead>
                <tr style={{ color: C.mutedForeground, fontSize: 22 }}>
                  <th style={{ textAlign: "left", fontWeight: 400, paddingBottom: 12 }} />
                  {years.map((y) => (
                    <th key={y.year} style={{ textAlign: "right", fontWeight: 400, paddingBottom: 12 }}>Year {y.year}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.label} style={{ borderTop: `1px solid ${C.border}` }}>
                    <td style={{ padding: "16px 0" }}>{row.label}</td>
                    {years.map((y) => {
                      const v = row.value(y);
                      const lit = row.flag && v > 0.0005;
                      return (
                        <td
                          key={y.year}
                          style={{
                            textAlign: "right",
                            fontFamily: MONO,
                            padding: "16px 8px",
                            color: lit ? C.caution : C.foreground,
                            background: lit ? wash(C.caution, 0.14 * highlight) : undefined,
                          }}
                        >
                          {v.toFixed(1)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </FadeUp>
        <FadeUp delay={0.6}>
          <Card style={{ display: "grid", gap: 20 }}>
            <Label>Equity value in year {horizon}, 1,000 paths</Label>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 220 }}>
              {monteCarlo.histogram.map((b, i) => (
                <div key={i} style={{ flex: 1, height: `${(b.count / peak) * 100 * grow}%`, background: b.to <= 0 ? C.critical : C.metric, borderRadius: 4, opacity: 0.85 }} />
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 24 }}>
              <span>P10 {formatMoney(p10)}</span>
              <span>P50 {formatMoney(p50)}</span>
              <span>P90 {formatMoney(p90)}</span>
            </div>
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
              <Badge tone={monteCarlo.covenantBreachProbability >= 0.25 ? "critical" : monteCarlo.covenantBreachProbability > 0.05 ? "caution" : "positive"}>
                {formatPercent(monteCarlo.covenantBreachProbability)} chance of a covenant breach
              </Badge>
            </div>
          </Card>
        </FadeUp>
      </div>
    </Scene>
  );
}

/** Shot 4: client-safe presentation mode, four plain-language levers. */
export function Present() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const zoom = interpolate(frame, [0, 1.2 * fps], [0.94, 1], { extrapolateRight: "clamp" });
  const r = resultRecap;
  const tiles = [
    ["What the company is worth", formatMoney(r.enterpriseValue)],
    ["The family's equity", formatMoney(r.equityValue)],
    ["Cash to the family now", formatMoney(r.netDistribution)],
  ];
  return (
    <Scene eyebrow="Present" title="Client mode" caption="In the meeting, switch to client mode: four levers, outcomes in plain English, nothing internal on screen." captionAt={1.5}>
      <div style={{ transform: `scale(${zoom})`, transformOrigin: "top center", display: "grid", gridTemplateColumns: "620px 1fr", gap: 36 }}>
        <Card style={{ display: "grid", gap: 30 }}>
          <Slider label="Borrowing" display={formatMultiple(RECAP_LEVERAGE)} fraction={RECAP_LEVERAGE / 6} />
          <Slider label="Shares to the next generation" display="0%" fraction={0} />
          <Slider label="Market mood" display="Steady" fraction={0.5} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 26 }}>
            <span>Outside CEO</span>
            <span style={{ color: C.mutedForeground }}>Off</span>
          </div>
        </Card>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignContent: "start" }}>
          {tiles.map(([label, value], i) => (
            <FadeUp key={label} delay={0.4 + i * 0.15}>
              <Kpi label={label} value={value} />
            </FadeUp>
          ))}
        </div>
      </div>
    </Scene>
  );
}
