import { describe, expect, it } from "vitest";
import { roomBrief } from "../narrative/room";
import { defaultSnapshot } from "../persistence/serialize";
import { detectGaps } from "../room/gaps";
import { DEMO_RESPONSES } from "../room/topics";
import { REPORT_SECTIONS, buildReport, type ReportInput } from "./build";
import { pdfText } from "./pdf-text";

const ALL = REPORT_SECTIONS.map((s) => s.id);
const input = (patch: Partial<ReportInput> = {}): ReportInput => ({
  companyName: "Hartwell Family Holdings",
  preparedBy: "Jordan Advisors",
  snapshot: defaultSnapshot(),
  gaps: detectGaps(DEMO_RESPONSES),
  sections: ALL,
  generatedAt: new Date("2026-10-14T12:00:00Z"),
  ...patch,
});

describe("room brief", () => {
  it("waits for at least two stakeholders", () => {
    const b = roomBrief(detectGaps({ founder: DEMO_RESPONSES.founder }));
    expect(b.tone).toBe("caution");
    expect(b.headline).toContain("1 of 4 stakeholders have submitted");
    expect(b.actions).toEqual(["Collect the views of the next-gen heir, the board and the lender before the decision is taken."]);
  });

  it("names the gating disagreements and who misreads whom in the demo room", () => {
    const gaps = detectGaps(DEMO_RESPONSES);
    const b = roomBrief(gaps);
    expect(b.tone).toBe("critical");
    expect(b.headline).toMatch(/^Alignment is the gating risk: \d+ contested topics? and \d+ misperceptions? \(\d+ critical\) across 4 stakeholders\.$/);
    expect(b.findings[0]).toContain(`“${gaps.disagreements[0].topic}”`);
    expect(b.actions[0]).toMatch(/^Facilitate a structured conversation between the /);
  });

  it("calls a unanimous room aligned", () => {
    const same = DEMO_RESPONSES.founder!;
    const aligned = { founder: { ...same, predictions: same.positions }, nextGen: { ...same, predictions: same.positions } };
    const b = roomBrief(detectGaps(aligned));
    expect(b.tone).toBe("positive");
    expect(b.actions[0]).toBe("Collect the views of the board and the lender before the decision is taken.");
  });
});

describe("buildReport", () => {
  it("reports the demo company with the same figures as the app", () => {
    const r = buildReport(input());
    expect(r.dateLabel).toBe("October 14, 2026");
    expect(r.headlineKpis).toEqual([
      { label: "Enterprise value", value: "$96.0M" },
      { label: "Equity value", value: "$90.0M" },
      { label: "Interest coverage", value: "25.0x" },
      { label: "Governance debt", value: "78/100" },
      { label: "Value at risk", value: "$22.5M" },
    ]);
    expect(r.capital.kpis.every((k) => k.change === "–")).toBe(true);
    expect(r.redTeam.shocks).toHaveLength(4);
    expect(r.bottomLine.map((b) => b.section)).toEqual(["Governance debt", "Red Team stress test", "Decision Room"]);
  });

  it("judges a recap's changes against today, without judging the new debt itself", () => {
    const snapshot = defaultSnapshot();
    const r = buildReport(input({ snapshot: { ...snapshot, scenario: { ...snapshot.scenario, leverage: 4 } } }));
    const row = (label: string) => r.capital.kpis.find((k) => k.label === label)!;
    expect(row("Equity value")).toMatchObject({ today: "$90.0M", scenario: "$48.0M", change: "−$42.0M", good: false });
    expect(row("Total debt")).toMatchObject({ change: "+$42.0M", good: null });
    expect(row("Debt / EBITDA").good).toBe(false);
  });

  it("includes only the chosen sections, in report order", () => {
    const r = buildReport(input({ sections: ["room", "capital"] }));
    expect(r.sections).toEqual(["capital", "room"]);
    expect(r.bottomLine.map((b) => b.section)).toEqual(["Decision Room"]);
  });

  it("never carries a stakeholder's raw answers", () => {
    const json = JSON.stringify(buildReport(input()));
    expect(json).not.toMatch(/positions|predictions/);
  });
});

describe("pdfText", () => {
  it("maps characters Helvetica can't draw and keeps the ones it can", () => {
    expect(pdfText("−$42.0M · $90.0M → $48.0M · ≥2 × 3")).toBe("-$42.0M · $90.0M -> $48.0M · >=2 × 3");
    expect(pdfText("a\u00a0b\u202fc")).toBe("a b c");
  });
});
