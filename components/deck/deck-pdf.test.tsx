import { inflateSync } from "node:zlib";
import { renderToBuffer } from "@react-pdf/renderer";
import { expect, it } from "vitest";
import { buildRedTeamDeck } from "@/lib/deck/redteam";
import { DEMO_GOVERNANCE } from "@/lib/governance/model";
import { DEMO_BASELINE, neutralScenario } from "@/lib/simulator/defaults";
import { DeckDocument } from "./deck-pdf";

it("renders one landscape page per slide, each numbered", async () => {
  const deck = buildRedTeamDeck({
    companyName: "Hartwell Family Holdings",
    preparedBy: "",
    baseline: DEMO_BASELINE,
    scenario: neutralScenario(DEMO_BASELINE),
    governance: DEMO_GOVERNANCE,
    generatedAt: new Date("2026-10-14T12:00:00Z"),
  });
  const pdf = await renderToBuffer(<DeckDocument deck={deck} />);
  const raw = pdf.toString("latin1");
  expect(raw).toContain("/MediaBox [0 0 792 612]");
  const pages = [...raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)].map((m) => {
    try {
      return inflateSync(Buffer.from(m[1], "latin1")).toString("latin1");
    } catch {
      return "";
    }
  });
  expect(pages).toHaveLength(deck.slides.length);
  const hex = (text: string) => Buffer.from(text, "latin1").toString("hex");
  pages.forEach((p, i) => expect(p).toContain(hex(`${i + 1} / ${deck.slides.length}`)));
}, 30_000);
