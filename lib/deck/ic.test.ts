import { describe, expect, it } from "vitest";
import { defaultSnapshot } from "../persistence/serialize";
import { REPORT_SECTIONS, buildReport } from "../report/build";
import { detectGaps } from "../room/gaps";
import { DEMO_RESPONSES } from "../room/topics";
import { buildIcDeck, type IcDeckInput } from "./ic";
import { deckToPptx } from "./pptx";
import { toMarp } from "./redteam";

const snapshot = (() => {
  const s = defaultSnapshot();
  return { ...s, scenario: { ...s.scenario, leverage: 4 } };
})();
const input: IcDeckInput = {
  companyName: "Hartwell Family Holdings",
  preparedBy: "Jordan Lee",
  snapshot,
  gaps: detectGaps(DEMO_RESPONSES),
  generatedAt: new Date("2026-10-14T12:00:00Z"),
};

describe("IC deck", () => {
  const deck = buildIcDeck(input);
  const slide = (title: string) => deck.slides.find((s) => s.title === title)!;

  it("runs from the bottom line to recommended actions", () => {
    expect(deck.slides.map((s) => s.title)).toEqual([
      "Investment committee memo",
      "Bottom line",
      "The decision against today",
      "Ten-year financial summary",
      "Range of outcomes",
      "Liquidity & covenants",
      "Stress scenarios",
      "Governance",
      "Stakeholder alignment",
      "Recommended actions",
      "Method",
    ]);
    expect(deck).toMatchObject({ kind: "Investment committee memo", company: "Hartwell Family Holdings" });
  });

  it("shows the same figures as the PDF report", () => {
    const report = buildReport({ ...input, gaps: input.gaps!, sections: REPORT_SECTIONS.map((s) => s.id) });
    const table = slide("The decision against today");
    expect(table.kind === "table" && table.rows.map((r) => r.cells)).toEqual(
      report.capital.kpis.map((k) => [k.label, k.today, k.scenario, k.change]),
    );
    expect(slide("Bottom line")).toMatchObject({ headline: report.redTeam.brief.headline });
  });

  it("flags the 4x recap's liquidity crunch for this decision but not for today", () => {
    const t = slide("Liquidity & covenants");
    expect(t.kind === "table" && t.rows[0].cells[1]).toBe("Clear");
    expect(t.kind === "table" && t.rows[1].cells[1]).toContain("Liquidity crunch (Y1–Y3)");
  });

  it("leaves the alignment slide out without room data, and never carries answers", () => {
    expect(buildIcDeck({ ...input, gaps: null }).slides.some((s) => s.title === "Stakeholder alignment")).toBe(false);
    expect(JSON.stringify(deck)).not.toMatch(/positions|predictions/);
  });

  it("uses the company's saved three-statement inputs, not the defaults", () => {
    const taxed = buildIcDeck({
      ...input,
      snapshot: { ...snapshot, fork: { ...snapshot.fork, statements: { ...snapshot.fork.statements, taxRate: 0.4 } } },
    });
    const summary = (d: typeof deck) => d.slides.find((s) => s.title === "Ten-year financial summary")!;
    expect(JSON.stringify(summary(taxed))).toContain("40% tax");
    expect(JSON.stringify(summary(deck))).toContain("25% tax");
  });

  it("caps recommended actions and removes duplicates", () => {
    const actions = slide("Recommended actions");
    expect(actions.kind === "bullets" && actions.bullets.length).toBeLessThanOrEqual(6);
    expect(actions.kind === "bullets" && new Set(actions.bullets).size).toBe(actions.kind === "bullets" ? actions.bullets.length : 0);
  });

  it("renders to .pptx with a watermark and to Marp with a footer", async () => {
    const file = Buffer.from((await deckToPptx(deck, "nodebuffer", { footer: "BridgeGen · Draft", watermark: "DRAFT" })) as Uint8Array);
    const raw = file.toString("latin1");
    expect(raw).toContain(`ppt/slides/slide${deck.slides.length}.xml`);
    expect(toMarp(deck, "BridgeGen · Draft · Prepared for Hartwell")).toContain('footer: "BridgeGen · Draft · Prepared for Hartwell"');
  }, 30_000);
});
