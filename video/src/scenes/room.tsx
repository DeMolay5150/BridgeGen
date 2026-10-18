import { interpolate } from "remotion";
import type { CaseResult } from "../../../lib/alerts/liquidity";
import type { Verdict } from "../../../lib/redteam/types";
import { STAKEHOLDER_LABELS } from "../../../lib/simulator/alignment";
import { formatMoney, formatPercent } from "../../../lib/simulator/format";
import type { Severity } from "../../../lib/simulator/types";
import { gaps, governance, governanceFixed, liquidity, ownershipAt, redTeam, room, shocks } from "../data";
import { C, MONO, TONE, wash } from "../theme";
import { Badge, Card, FadeUp, Label, Scene, Slider, useProgress } from "../ui";

const VERDICT_TONE: Record<Verdict, Severity> = { survives: "positive", strained: "caution", breaks: "critical" };

/** Shot 5: the facilitator's view: where views diverge, never who said what. */
export function RoomGaps() {
  const disagreements = gaps.disagreements.slice(0, 3);
  const misperceptions = gaps.misperceptions.slice(0, 3);
  return (
    <Scene
      eyebrow="Decision Room"
      title="Where the family disagrees"
      caption="Each stakeholder answers privately through their own link. You never see who said what, only where the family disagrees, and who has misread whom."
      captionAt={2.5}
    >
      <div style={{ display: "grid", gap: 28 }}>
        <FadeUp delay={0.2}>
          <Card style={{ borderColor: wash(TONE[room.tone], 0.5), background: wash(TONE[room.tone], 0.06) }}>
            <div style={{ fontSize: 32, lineHeight: 1.35 }}>{room.headline}</div>
          </Card>
        </FadeUp>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28 }}>
          <FadeUp delay={0.6}>
            <Card style={{ display: "grid", gap: 18 }}>
              <Label>Disagreements · {gaps.disagreements.length}</Label>
              {disagreements.map((d) => (
                <div key={d.topicId} style={{ display: "flex", justifyContent: "space-between", gap: 20, fontSize: 26 }}>
                  <span>{d.topic}</span>
                  <Badge tone={d.severity}>{d.spread}-pt spread</Badge>
                </div>
              ))}
            </Card>
          </FadeUp>
          <FadeUp delay={0.9}>
            <Card style={{ display: "grid", gap: 18 }}>
              <Label>Misperceptions · {gaps.misperceptions.length}</Label>
              {misperceptions.map((m) => (
                <div key={`${m.observer}-${m.topicId}`} style={{ display: "flex", justifyContent: "space-between", gap: 20, fontSize: 26 }}>
                  <span>
                    The {STAKEHOLDER_LABELS[m.observer].toLowerCase()} misreads the {STAKEHOLDER_LABELS[m.target].toLowerCase()}
                    <span style={{ color: C.mutedForeground }}> · {m.topic}</span>
                  </span>
                  <Badge tone={m.severity}>off by {m.gap}</Badge>
                </div>
              ))}
            </Card>
          </FadeUp>
        </div>
      </div>
    </Scene>
  );
}

/** Shot 6: the Map: ownership reprices as shares move; documenting authority cuts governance debt. */
export function RoomMap() {
  const transfer = 0.4 * useProgress(1, 6);
  const own = ownershipAt(transfer);
  const fixed = useProgress(9, 11);
  const score = Math.round(interpolate(fixed, [0, 1], [governance.score, governanceFixed.score]));
  const holders: [string, number, string][] = [
    ["Founder", own.founder, C.metric],
    ["Next-gen heir", own.nextGen, C.positive],
    ["Others", own.others, C.mutedForeground],
  ];
  return (
    <Scene eyebrow="Decision Room · Map" title="Ownership and authority, as a map you can move" caption="Ownership and authority, as a map you can move." captionAt={1}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 36 }}>
        <FadeUp delay={0.2}>
          <Card style={{ display: "grid", gap: 30 }}>
            <Label>Ownership cascade</Label>
            <Slider label="Founder transfers to the next generation" display={formatPercent(transfer)} fraction={transfer} />
            <div style={{ display: "flex", height: 64, borderRadius: 12, overflow: "hidden" }}>
              {holders.map(([label, share, color]) => (
                <div key={label} style={{ width: `${share * 100}%`, background: color, opacity: 0.85 }} />
              ))}
            </div>
            <div style={{ display: "grid", gap: 12 }}>
              {holders.map(([label, share, color]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 26 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ width: 14, height: 14, borderRadius: 7, background: color }} />
                    {label}
                  </span>
                  <span style={{ fontFamily: MONO }}>{formatPercent(share, 1)}</span>
                </div>
              ))}
            </div>
          </Card>
        </FadeUp>
        <FadeUp delay={0.5}>
          <Card style={{ display: "grid", gap: 24 }}>
            <Label>Governance voting tree</Label>
            <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
              <span style={{ fontFamily: MONO, fontSize: 96, color: score >= 60 ? C.critical : score >= 30 ? C.caution : C.positive }}>{score}</span>
              <span style={{ fontSize: 28, color: C.mutedForeground }}>/ 100 governance debt</span>
            </div>
            {governance.categories.map((c) => (
              <div key={c.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 26 }}>
                <span>{c.label}</span>
                <span style={{ fontFamily: MONO, color: C.mutedForeground }}>
                  {Math.round(c.id === "authority" ? interpolate(fixed, [0, 1], [c.points, governanceFixed.categories.find((x) => x.id === c.id)!.points]) : c.points)} / {c.maxPoints}
                </span>
              </div>
            ))}
            <div style={{ opacity: fixed }}>
              <Badge tone="positive">Delegated authority documented</Badge>
            </div>
          </Card>
        </FadeUp>
      </div>
    </Scene>
  );
}

function CaseCell({ title, result }: { title: string; result: CaseResult }) {
  return (
    <div style={{ display: "grid", gap: 8, padding: 18, borderRadius: 14, background: wash(TONE[result.severity], 0.08) }}>
      <span style={{ fontSize: 20, color: C.mutedForeground }}>{title}</span>
      <span style={{ fontSize: 24, color: TONE[result.severity] }}>{result.alerts.length ? result.alerts[0].title : "Clear"}</span>
    </div>
  );
}

/** Shot 7: Red Team attacks the plan. */
export function RedTeam() {
  const saved = Math.max(0, ...shocks.map((s) => s.dividend?.valueSaved ?? 0));
  return (
    <Scene
      eyebrow="Red Team"
      title="Attack the plan before the market does"
      caption={`Red Team mode attacks the plan: founder incapacity, a successor walking away, a downturn. It flags the liquidity crunch and names the cheapest hedge: here, ${formatMoney(saved)} preserved by documenting authority and succession.`}
      captionAt={4}
    >
      <div style={{ display: "grid", gap: 26 }}>
        <FadeUp delay={0.2}>
          <Card style={{ borderColor: wash(TONE[redTeam.tone], 0.5), background: wash(TONE[redTeam.tone], 0.06), padding: 26 }}>
            <div style={{ fontSize: 30, lineHeight: 1.35 }}>{redTeam.headline}</div>
          </Card>
        </FadeUp>
        <div style={{ display: "grid", gridTemplateColumns: "1.25fr 1fr", gap: 28 }}>
          <FadeUp delay={0.6}>
            <Card style={{ display: "grid", gap: 16, padding: 28 }}>
              {shocks.map((s) => (
                <div key={s.id} style={{ display: "grid", gridTemplateColumns: "1fr auto 170px", gap: 20, alignItems: "center", fontSize: 26 }}>
                  <span>{s.name}</span>
                  <Badge tone={VERDICT_TONE[s.verdict]}>{s.verdict}</Badge>
                  <span style={{ fontFamily: MONO, textAlign: "right", color: C.critical }}>−{formatMoney(Math.max(s.valueDestroyed, 0))}</span>
                </div>
              ))}
            </Card>
          </FadeUp>
          <FadeUp delay={1}>
            <Card style={{ display: "grid", gap: 14, padding: 28 }}>
              <Label>Liquidity · base vs downturn</Label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <CaseCell title="Today · base" result={liquidity.today.base} />
                <CaseCell title="Today · downturn" result={liquidity.today.downturn} />
                <CaseCell title="Your scenario · base" result={liquidity.scenario.base} />
                <CaseCell title="Your scenario · downturn" result={liquidity.scenario.downturn} />
              </div>
            </Card>
          </FadeUp>
        </div>
      </div>
    </Scene>
  );
}
