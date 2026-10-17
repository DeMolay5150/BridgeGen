import { compareLiquidity, type CaseResult } from "../alerts/liquidity";
import type { CompanySnapshot } from "../persistence/serialize";
import { buildReport, REPORT_SECTIONS } from "../report/build";
import { detectGaps } from "../room/gaps";
import type { RoomGaps } from "../room/types";
import { formatMoney, formatMultiple, formatPercent } from "../simulator/format";
import type { Severity } from "../simulator/types";
import { buildStatements, statementAssumptions } from "../statements/model";
import { runMonteCarlo } from "../statements/monte-carlo";
import { buildRedTeamDeck, type Deck, type Slide } from "./redteam";

export interface IcDeckInput {
  companyName: string;
  preparedBy: string;
  snapshot: CompanySnapshot;
  /** Decision Room gap analysis, or null to leave the alignment slide out. Never raw answers. */
  gaps: RoomGaps | null;
  generatedAt: Date;
}

const SUMMARY_YEARS = [1, 3, 5, 10];
const MAX_ACTIONS = 6;

const toneOf = (good: boolean | null): Severity | undefined => (good === null ? undefined : good ? "positive" : "critical");

function caseSummary(c: CaseResult): string {
  return c.alerts.length === 0 ? "Clear" : c.alerts.map((a) => `${a.title} (Y${a.years[0]}${a.years.length > 1 ? `–Y${a.years.at(-1)}` : ""})`).join("; ");
}

/**
 * Investment-committee deck for the live scenario. Assembles outputs the app
 * already shows (report, three statements, Monte Carlo, liquidity, Red Team,
 * Decision Room gaps); it computes nothing of its own.
 */
export function buildIcDeck(input: IcDeckInput): Deck {
  const { snapshot } = input;
  const date = new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(input.generatedAt);
  const report = buildReport({
    companyName: input.companyName,
    preparedBy: input.preparedBy,
    snapshot,
    gaps: input.gaps ?? detectGaps({}),
    sections: REPORT_SECTIONS.map((s) => s.id).filter((id) => id !== "room" || input.gaps !== null),
    generatedAt: input.generatedAt,
  });
  const assumptions = statementAssumptions(snapshot.fork);
  const statements = buildStatements(snapshot.baseline, snapshot.scenario, assumptions);
  const risk = runMonteCarlo(snapshot.baseline, snapshot.scenario, assumptions);
  const liquidity = compareLiquidity(snapshot.baseline, snapshot.scenario, assumptions);
  const redTeam = buildRedTeamDeck({
    companyName: input.companyName,
    preparedBy: input.preparedBy,
    baseline: snapshot.baseline,
    scenario: snapshot.scenario,
    governance: snapshot.governance,
    generatedAt: input.generatedAt,
  });
  const stressTable = redTeam.slides.find((s) => s.kind === "table" && s.title === "Stress scenarios")!;
  const years = SUMMARY_YEARS.map((y) => statements.years[y]);
  const breachTone: Severity = risk.covenantBreachProbability >= 0.25 ? "critical" : risk.covenantBreachProbability >= 0.1 ? "caution" : "positive";
  const redTeamLine = report.bottomLine.find((b) => b.section === "Red Team stress test")!;

  const actions = [
    ...report.redTeam.brief.actions,
    ...report.governance.brief.actions.slice(0, 2),
    ...(input.gaps ? report.room.brief.actions.slice(0, 2) : []),
  ];

  const slides: Slide[] = [
    {
      kind: "title",
      title: "Investment committee memo",
      subtitle: input.companyName,
      meta: [report.capital.scenario, [input.preparedBy, date].filter(Boolean).join(" · "), "Confidential"],
    },
    {
      kind: "headline",
      title: "Bottom line",
      headline: redTeamLine.headline,
      tone: redTeamLine.tone,
      kpis: [
        { label: "Equity IRR, 10 years", value: statements.equityIrr === null ? "n/a" : formatPercent(statements.equityIrr, 1), tone: "positive" },
        { label: `Covenant breach odds, ${risk.settings.horizon} yrs`, value: formatPercent(risk.covenantBreachProbability, 1), tone: breachTone },
        { label: "Governance value at risk", value: report.headlineKpis.find((k) => k.label === "Value at risk")!.value, tone: "caution" },
      ],
    },
    {
      kind: "table",
      title: "The decision against today",
      columns: ["Metric", "Today", "This decision", "Change"],
      widths: [2, 1, 1, 1],
      toneColumn: 3,
      rows: report.capital.kpis.map((k) => ({ cells: [k.label, k.today, k.scenario, k.change], tone: toneOf(k.good) })),
      note: `Economics ${report.capital.economics}/100 · stakeholder alignment ${report.capital.alignment}/100.`,
    },
    {
      kind: "table",
      title: "Ten-year financial summary",
      columns: ["$M", ...SUMMARY_YEARS.map((y) => `Year ${y}`)],
      widths: [1.6, 1, 1, 1, 1],
      rows: [
        { cells: ["Revenue", ...years.map((y) => formatMoney(y.revenue))] },
        { cells: ["EBITDA", ...years.map((y) => formatMoney(y.ebitda))] },
        { cells: ["Free cash flow", ...years.map((y) => formatMoney(y.freeCashFlow))] },
        { cells: ["Debt", ...years.map((y) => formatMoney(y.debt))] },
        { cells: ["Interest coverage", ...years.map((y) => formatMultiple(y.interestCoverage))] },
        { cells: ["Equity value", ...years.map((y) => formatMoney(y.equityValue))] },
      ],
      note: `Linked three-statement model, ${formatPercent(assumptions.revenueGrowth)} revenue growth, ${formatPercent(assumptions.taxRate)} tax. WACC ${statements.wacc === null ? "n/a" : formatPercent(statements.wacc, 1)}.`,
    },
    {
      kind: "bullets",
      title: "Range of outcomes",
      bullets: [
        `${risk.settings.paths.toLocaleString("en-US")} simulated paths with yearly growth and margin shocks and a one-off exit-multiple shift (seeded, reproducible).`,
        `Year-${risk.settings.horizon} equity value: ${formatMoney(risk.equityValue.p10)} in a bad case, ${formatMoney(risk.equityValue.p50)} typical, ${formatMoney(risk.equityValue.p90)} in a good case (base case ${formatMoney(risk.baseCaseEquityValue)}).`,
        `Covenant breach in ${formatPercent(risk.covenantBreachProbability, 1)} of paths by year ${risk.settings.horizon}; equity wiped out in ${formatPercent(risk.equityWipeoutProbability, 1)}.`,
        ...(risk.equityIrr ? [`Equity IRR: ${formatPercent(risk.equityIrr.p10, 1)} to ${formatPercent(risk.equityIrr.p90, 1)} (P10–P90).`] : []),
      ],
    },
    {
      kind: "table",
      title: "Liquidity & covenants",
      columns: ["", "Base case", "Downturn"],
      widths: [1, 2.5, 2.5],
      rows: [
        { cells: ["Today", caseSummary(liquidity.today.base), caseSummary(liquidity.today.downturn)] },
        { cells: ["This decision", caseSummary(liquidity.scenario.base), caseSummary(liquidity.scenario.downturn)], tone: liquidity.scenario.downturn.severity },
      ],
      toneColumn: 2,
      note: "Downturn: revenue −15% and margin −2 points in year 1, flat revenue in year 2, then recovery.",
    },
    stressTable,
    {
      kind: "bullets",
      title: "Governance",
      bullets: [report.governance.brief.headline, ...report.governance.brief.findings.slice(0, 2)],
    },
    ...(input.gaps
      ? [{ kind: "bullets" as const, title: "Stakeholder alignment", bullets: [report.room.brief.headline, ...report.room.brief.findings] }]
      : []),
    { kind: "bullets", title: "Recommended actions", bullets: [...new Set(actions)].slice(0, MAX_ACTIONS), numbered: true },
    {
      kind: "bullets",
      title: "Method",
      bullets: [
        "Scenario, statements, stress tests and governance pricing are deterministic outputs of the BridgeGen engines; nothing is AI-generated.",
        "Decision Room findings show where views diverge, never anyone's answers.",
        "Illustrative analysis under stated assumptions; not a valuation, fairness opinion or investment advice.",
      ],
    },
  ];

  return { title: `${input.companyName}: Investment committee memo`, kind: "Investment committee memo", company: input.companyName, slides };
}
