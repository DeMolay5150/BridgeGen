import type { GovernanceAnswers } from "../governance/types";
import { redTeamBrief } from "../narrative/redteam";
import { breakingPoints } from "../redteam/breaking";
import { describeChanges } from "../redteam/describe";
import { SHOCKS, runShock } from "../redteam/shocks";
import type { BreakingPoint } from "../redteam/types";
import { scoreGovernance } from "../governance/model";
import { BASELINE_LIMITS, clamp, neutralScenario } from "../simulator/defaults";
import { describeScenario } from "../simulator/describe";
import { simulate } from "../simulator/engine";
import { formatMoney, formatPercent } from "../simulator/format";
import type { Baseline, Scenario, Severity } from "../simulator/types";

/*
 * One slide model for the Red Team deck. The .pptx, .pdf and Marp renderers
 * only lay it out, so the three formats can never disagree.
 */

export type Slide =
  | { kind: "title"; title: string; subtitle: string; meta: string[] }
  | { kind: "headline"; title: string; headline: string; tone: Severity; kpis: { label: string; value: string; tone?: Severity }[] }
  | { kind: "bullets"; title: string; bullets: string[]; numbered?: boolean }
  | {
      kind: "table";
      title: string;
      columns: string[];
      /** Relative column widths, shared by every renderer. */
      widths: number[];
      rows: { cells: string[]; tone?: Severity }[];
      note?: string;
    };

export interface Deck {
  title: string;
  slides: Slide[];
}

export interface DeckInput {
  companyName: string;
  preparedBy: string;
  baseline: Baseline;
  scenario: Scenario;
  governance: GovernanceAnswers;
  generatedAt: Date;
}

const VERDICT = { survives: "Survives", strained: "Strained", breaks: "Breaks" } as const;
const VERDICT_TONE = { survives: "positive", strained: "caution", breaks: "critical" } as const;

function threshold(p: BreakingPoint | undefined): string {
  if (!p || p.threshold === null) return "Can't break";
  return p.threshold === 0 ? "Already broken" : `${formatPercent(p.threshold, 1)} fall`;
}

export function buildRedTeamDeck(input: DeckInput): Deck {
  const { baseline, scenario, governance } = input;
  const rate = clamp(baseline.interestRate, BASELINE_LIMITS.interestRate);
  const yours = breakingPoints(simulate(baseline, scenario), rate);
  const today = breakingPoints(simulate(baseline, neutralScenario(baseline)), rate);
  const shocks = SHOCKS.map((s) => runShock(baseline, scenario, governance, s.id));
  const brief = redTeamBrief(shocks, yours, today);
  const failed = shocks.filter((s) => s.verdict === "breaks").length;
  const worst = [...shocks].sort((a, b) => b.valueDestroyed - a.valueDestroyed)[0];
  const headroom = yours.find((p) => p.threshold !== null);
  const date = new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(input.generatedAt);

  return {
    title: `${input.companyName}: Red Team stress test`,
    slides: [
      {
        kind: "title",
        title: "Red Team stress test",
        subtitle: input.companyName,
        meta: [describeScenario(scenario, scoreGovernance(governance).score), [input.preparedBy, date].filter(Boolean).join(" · "), "Confidential"],
      },
      {
        kind: "headline",
        title: "Bottom line",
        headline: brief.headline,
        tone: brief.tone,
        kpis: [
          { label: "Stress cases failed", value: `${failed} of ${shocks.length}`, tone: failed > 0 ? "critical" : "positive" },
          { label: "Worst equity loss", value: formatMoney(Math.max(worst.valueDestroyed, 0)), tone: "critical" },
          { label: "Headroom to first limit", value: headroom ? threshold(headroom).replace(" fall", "") : "No debt", tone: headroom?.severity },
        ],
      },
      { kind: "bullets", title: "Key findings", bullets: brief.findings },
      {
        kind: "table",
        title: "Stress scenarios",
        columns: ["Scenario", "What happens", "Verdict", "Equity", "Value destroyed", "Saved by governance"],
        widths: [1.4, 2.6, 0.8, 1.6, 1, 1.1],
        rows: shocks.map((s) => ({
          cells: [
            s.name,
            describeChanges(s.changes),
            VERDICT[s.verdict],
            `${formatMoney(s.before.equityValue)} → ${formatMoney(s.after.equityValue)}`,
            formatMoney(Math.max(s.valueDestroyed, 0)),
            s.dividend && s.dividend.valueSaved > 0.05 ? formatMoney(s.dividend.valueSaved) : "–",
          ],
          tone: VERDICT_TONE[s.verdict],
        })),
      },
      {
        kind: "table",
        title: "Breaking points",
        columns: ["Limit", "Driver", "This decision", "Today"],
        widths: [2.4, 1.2, 1, 1],
        rows: yours.map((p) => ({
          cells: [p.limit, `${p.driver} falls`, threshold(p), threshold(today.find((t) => t.id === p.id))],
          tone: p.severity,
        })),
        note: "How far earnings or the valuation multiple can fall before each limit breaks.",
      },
      { kind: "bullets", title: "Recommended actions", bullets: brief.actions, numbered: true },
      {
        kind: "bullets",
        title: "Method",
        bullets: [
          "Each shock is applied to the scenario's post-decision balance sheet; its size scales with the matching governance gaps.",
          "Verdicts use 2.0x interest coverage and 5.0x debt/EBITDA as breaking limits, and 3.0x / 4.0x as caution levels.",
          "Every figure is a deterministic output of the BridgeGen engines; nothing is AI-generated. Illustrative, not a valuation or investment advice.",
        ],
      },
    ],
  };
}

/** Marp markdown (https://marp.app): render with `npx @marp-team/marp-cli deck.md --pdf` or `--pptx`. */
export function toMarp(deck: Deck): string {
  const escapeCell = (text: string) => text.replace(/\|/g, "\\|");
  const sections = deck.slides.map((slide) => {
    switch (slide.kind) {
      case "title":
        return `<!-- _class: lead -->\n\n# ${slide.title}\n\n## ${slide.subtitle}\n\n${slide.meta.join("  \n")}`;
      case "headline":
        return `## ${slide.title}\n\n> **${slide.headline}**\n\n${slide.kpis.map((k) => `- **${k.value}** ${k.label.toLowerCase()}`).join("\n")}`;
      case "bullets":
        return `## ${slide.title}\n\n${slide.bullets.map((b, i) => `${slide.numbered ? `${i + 1}.` : "-"} ${b}`).join("\n")}`;
      case "table":
        return [
          `## ${slide.title}`,
          "",
          `| ${slide.columns.map(escapeCell).join(" | ")} |`,
          `| ${slide.columns.map(() => "---").join(" | ")} |`,
          ...slide.rows.map((r) => `| ${r.cells.map(escapeCell).join(" | ")} |`),
          ...(slide.note ? ["", `_${slide.note}_`] : []),
        ].join("\n");
    }
  });
  const frontMatter = ["---", "marp: true", "theme: default", "class: invert", "paginate: true", `title: "${deck.title.replace(/"/g, "'")}"`, "---"].join("\n");
  return `${frontMatter}\n\n${sections.join("\n\n---\n\n")}\n`;
}
