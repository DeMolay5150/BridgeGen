import { describe, expect, it } from "vitest";
import { DEMO_GOVERNANCE } from "../governance/model";
import { redTeamBrief } from "../narrative/redteam";
import { breakingPoints } from "../redteam/breaking";
import { SHOCKS, runShock } from "../redteam/shocks";
import { DEMO_BASELINE, neutralScenario } from "../simulator/defaults";
import { simulate } from "../simulator/engine";
import { deckToPptx } from "./pptx";
import { buildRedTeamDeck, toMarp, type DeckInput } from "./redteam";

const scenario = { ...neutralScenario(DEMO_BASELINE), leverage: 4 };
const input: DeckInput = {
  companyName: "Hartwell | Holdings",
  preparedBy: "Jordan Lee",
  baseline: DEMO_BASELINE,
  scenario,
  governance: DEMO_GOVERNANCE,
  generatedAt: new Date("2026-10-14T12:00:00Z"),
};

describe("Red Team deck", () => {
  const deck = buildRedTeamDeck(input);

  it("tells the same story as the Red Team brief", () => {
    const shocks = SHOCKS.map((s) => runShock(DEMO_BASELINE, scenario, DEMO_GOVERNANCE, s.id));
    const brief = redTeamBrief(
      shocks,
      breakingPoints(simulate(DEMO_BASELINE, scenario), DEMO_BASELINE.interestRate),
      breakingPoints(simulate(DEMO_BASELINE, neutralScenario(DEMO_BASELINE)), DEMO_BASELINE.interestRate),
    );
    const headline = deck.slides.find((s) => s.kind === "headline");
    expect(headline).toMatchObject({ headline: brief.headline, tone: "critical" });
    expect(deck.slides.find((s) => s.title === "Recommended actions")).toMatchObject({ bullets: brief.actions });
    expect(deck.slides.map((s) => s.title)).toEqual([
      "Red Team stress test", "Bottom line", "Key findings", "Stress scenarios", "Breaking points", "Recommended actions", "Method",
    ]);
  });

  it("reports the 4x recap's headline numbers", () => {
    const headline = deck.slides[1];
    expect(headline.kind === "headline" && headline.kpis.map((k) => k.value)).toEqual(["2 of 4", "$63.7M", "20.0%"]);
  });

  it("writes valid Marp: front matter, one separator per slide break, escaped table pipes", () => {
    const md = toMarp(deck);
    expect(md.startsWith("---\nmarp: true\n")).toBe(true);
    expect(md.split("\n\n---\n\n")).toHaveLength(deck.slides.length);
    expect(md).toContain("## Hartwell | Holdings");
    expect(md).toContain("| Scenario | What happens | Verdict |");
  });

  it("renders a .pptx with one slide per deck slide", async () => {
    const file = Buffer.from((await deckToPptx(deck, "nodebuffer")) as Uint8Array);
    expect(file.subarray(0, 2).toString()).toBe("PK");
    const names = file.toString("latin1");
    expect(names).toContain(`ppt/slides/slide${deck.slides.length}.xml`);
    expect(names).not.toContain(`ppt/slides/slide${deck.slides.length + 1}.xml`);
  }, 30_000);
});
