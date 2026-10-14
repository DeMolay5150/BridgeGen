import { MAX_GOVERNANCE_DISCOUNT, governanceDebtValue, scoreGovernance } from "../governance/model";
import { governanceBrief } from "../narrative/governance";
import { redTeamBrief } from "../narrative/redteam";
import { roomBrief } from "../narrative/room";
import type { ExecutiveBrief } from "../narrative/types";
import type { CompanySnapshot } from "../persistence/serialize";
import { breakingPoints } from "../redteam/breaking";
import { SHOCKS, runShock } from "../redteam/shocks";
import type { Verdict } from "../redteam/types";
import type { RoomGaps } from "../room/types";
import { STAKEHOLDER_LABELS, scoreScenario } from "../simulator/alignment";
import { BASELINE_LIMITS, clamp, neutralScenario } from "../simulator/defaults";
import { describeScenario } from "../simulator/describe";
import { simulate } from "../simulator/engine";
import { formatMoney, formatMultiple, formatPercent, formatSignedMoney } from "../simulator/format";
import type { RiskSignal, Severity, SimulationResult } from "../simulator/types";

export type ReportSectionId = "capital" | "governance" | "redTeam" | "room";

export const REPORT_SECTIONS: { id: ReportSectionId; label: string; hint: string }[] = [
  { id: "capital", label: "Capital allocation", hint: "Scenario vs. today, risk signals, stakeholder support" },
  { id: "governance", label: "Governance debt", hint: "Score, value at risk, remediation plan" },
  { id: "redTeam", label: "Red Team stress test", hint: "Shock outcomes and the cheapest hedge" },
  { id: "room", label: "Decision Room", hint: "Disagreements and misperceptions; never anyone's answers" },
];

export interface ReportInput {
  companyName: string;
  preparedBy: string;
  snapshot: CompanySnapshot;
  /** Gap analysis only (`detectGaps` output); raw answers never enter a report. */
  gaps: RoomGaps;
  sections: ReportSectionId[];
  generatedAt: Date;
}

export interface KpiRow {
  label: string;
  today: string;
  scenario: string;
  change: string;
  /** Whether the change helps or hurts shareholders; null when flat or not comparable. */
  good: boolean | null;
}

export interface ShockRow {
  name: string;
  verdict: Verdict;
  equity: string;
  valueDestroyed: string;
  governanceSaving: string;
}

export interface ReportData {
  companyName: string;
  preparedBy: string;
  dateLabel: string;
  sections: ReportSectionId[];
  /** One headline per included section, in report order. */
  bottomLine: { section: string; headline: string; tone: Severity }[];
  headlineKpis: { label: string; value: string }[];
  capital: {
    scenario: string;
    kpis: KpiRow[];
    signals: RiskSignal[];
    economics: number;
    alignment: number;
    stakeholders: { label: string; support: number }[];
  };
  governance: {
    brief: ExecutiveBrief;
    score: number;
    atRisk: string;
    categories: { label: string; points: string; share: number }[];
  };
  redTeam: { brief: ExecutiveBrief; shocks: ShockRow[] };
  room: {
    brief: ExecutiveBrief;
    submitted: number;
    disagreements: { topic: string; spread: number; severity: Severity }[];
    misperceptions: { observer: string; target: string; topic: string; severity: Severity }[];
  };
}

/** Changes under $50K (or 0.05x) are flat. */
const FLAT = 0.05;

const NO_CHANGE = "–";

/** `higherIsBetter` null: the change is reported but not judged (e.g. debt taken on for a recap). */
function moneyRow(label: string, today: number, scenario: number, higherIsBetter: boolean | null): KpiRow {
  const change = scenario - today;
  const flat = Math.abs(change) < FLAT;
  return {
    label,
    today: formatMoney(today),
    scenario: formatMoney(scenario),
    change: flat ? NO_CHANGE : formatSignedMoney(change),
    good: flat || higherIsBetter === null ? null : change > 0 === higherIsBetter,
  };
}

function ratioRow(label: string, today: number | null, scenario: number | null, higherIsBetter: boolean): KpiRow {
  const comparable = today !== null && scenario !== null;
  const change = comparable ? scenario - today : 0;
  const flat = !comparable || Math.abs(change) < FLAT;
  return {
    label,
    today: formatMultiple(today),
    scenario: formatMultiple(scenario),
    change: flat ? NO_CHANGE : `${change > 0 ? "+" : "−"}${Math.abs(change).toFixed(1)}x`,
    good: flat ? null : change > 0 === higherIsBetter,
  };
}

function capitalKpis(today: SimulationResult, result: SimulationResult): KpiRow[] {
  return [
    moneyRow("Enterprise value", today.enterpriseValue, result.enterpriseValue, true),
    moneyRow("Equity value", today.equityValue, result.equityValue, true),
    moneyRow("Total debt", today.totalDebt, result.totalDebt, null),
    ratioRow("Interest coverage", today.interestCoverage, result.interestCoverage, true),
    ratioRow("Debt / EBITDA", today.debtToEbitda, result.debtToEbitda, false),
  ];
}

const dateFormatter = new Intl.DateTimeFormat("en-US", { dateStyle: "long" });

/**
 * Everything an executive-summary PDF shows, computed from the same engines as
 * the app. Pure: the PDF layer only lays these strings out.
 */
export function buildReport(input: ReportInput): ReportData {
  const { baseline, scenario, governance: answers, priorities } = input.snapshot;
  const governance = scoreGovernance(answers);
  const neutral = neutralScenario(baseline);
  const result = simulate(baseline, scenario, governance.score);
  const today = simulate(baseline, neutral, governance.score);
  const rate = clamp(baseline.interestRate, BASELINE_LIMITS.interestRate);
  const matrix = scoreScenario(baseline, scenario, governance.score, priorities);

  const shocks = SHOCKS.map((s) => runShock(baseline, scenario, answers, s.id));
  const briefs = {
    governance: governanceBrief(answers, result.enterpriseValue),
    redTeam: redTeamBrief(shocks, breakingPoints(result, rate), breakingPoints(today, rate)),
    room: roomBrief(input.gaps),
  };
  const sections = REPORT_SECTIONS.map((s) => s.id).filter((id) => input.sections.includes(id));
  const sectionLabel = (id: ReportSectionId) => REPORT_SECTIONS.find((s) => s.id === id)!.label;

  return {
    companyName: input.companyName,
    preparedBy: input.preparedBy,
    dateLabel: dateFormatter.format(input.generatedAt),
    sections,
    bottomLine: sections
      .filter((id): id is Exclude<ReportSectionId, "capital"> => id !== "capital")
      .map((id) => ({ section: sectionLabel(id), headline: briefs[id].headline, tone: briefs[id].tone })),
    headlineKpis: [
      { label: "Enterprise value", value: formatMoney(result.enterpriseValue) },
      { label: "Equity value", value: formatMoney(result.equityValue) },
      { label: "Interest coverage", value: formatMultiple(result.interestCoverage) },
      { label: "Governance debt", value: `${Math.round(governance.score)}/100` },
      { label: "Value at risk", value: formatMoney(governanceDebtValue(result.enterpriseValue, governance.score)) },
    ],
    capital: {
      scenario: describeScenario(scenario, governance.score),
      kpis: capitalKpis(today, result),
      signals: result.signals,
      economics: Math.round(matrix.economics),
      alignment: Math.round(matrix.alignment),
      stakeholders: matrix.stakeholders.map((s) => ({ label: s.label, support: Math.round(s.support) })),
    },
    governance: {
      brief: briefs.governance,
      score: Math.round(governance.score),
      atRisk: `${formatMoney(governanceDebtValue(result.enterpriseValue, governance.score))} (up to ${formatPercent(MAX_GOVERNANCE_DISCOUNT)} of enterprise value at 100/100)`,
      categories: governance.categories.map((c) => ({
        label: c.label,
        points: `${Math.round(c.points)}/${c.maxPoints}`,
        share: c.maxPoints > 0 ? c.points / c.maxPoints : 0,
      })),
    },
    redTeam: {
      brief: briefs.redTeam,
      shocks: shocks.map((s) => ({
        name: s.name,
        verdict: s.verdict,
        equity: `${formatMoney(s.before.equityValue)} → ${formatMoney(s.after.equityValue)}`,
        valueDestroyed: formatMoney(Math.max(s.valueDestroyed, 0)),
        governanceSaving: s.dividend && s.dividend.valueSaved > FLAT ? formatMoney(s.dividend.valueSaved) : NO_CHANGE,
      })),
    },
    room: {
      brief: briefs.room,
      submitted: Object.values(input.gaps.completion).filter(Boolean).length,
      disagreements: input.gaps.disagreements.map((d) => ({ topic: d.topic, spread: d.spread, severity: d.severity })),
      misperceptions: input.gaps.misperceptions.map((m) => ({
        observer: STAKEHOLDER_LABELS[m.observer],
        target: STAKEHOLDER_LABELS[m.target],
        topic: m.topic,
        severity: m.severity,
      })),
    },
  };
}
