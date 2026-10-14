import type PptxGenJS from "pptxgenjs";
import type { Severity } from "../simulator/types";
import type { Deck, Slide } from "./redteam";

/* Quiet Luxury palette, as PowerPoint hex. */
const C = {
  background: "020617",
  panel: "0F172A",
  rule: "1E293B",
  text: "F8FAFC",
  muted: "94A3B8",
  metric: "22D3EE",
  positive: "34D399",
  caution: "FBBF24",
  critical: "FB7185",
};
const TONE: Record<Severity, string> = { positive: C.positive, caution: C.caution, critical: C.critical };
const FONT = "Arial";

// LAYOUT_WIDE is 13.33 × 7.5 inches.
const MARGIN = 0.6;
const WIDTH = 13.33 - 2 * MARGIN;

function chrome(slide: PptxGenJS.Slide, index: number, total: number, title?: string) {
  slide.background = { color: C.background };
  slide.addText("BRIDGEGEN", { x: MARGIN, y: 0.3, w: 4, h: 0.3, fontFace: FONT, fontSize: 9, bold: true, color: C.metric, charSpacing: 4 });
  slide.addText(`${index} / ${total}`, { x: 13.33 - MARGIN - 2, y: 6.95, w: 2, h: 0.3, fontFace: FONT, fontSize: 9, color: C.muted, align: "right" });
  slide.addText("Confidential", { x: MARGIN, y: 6.95, w: 4, h: 0.3, fontFace: FONT, fontSize: 9, color: C.muted });
  if (title) {
    slide.addText(title, { x: MARGIN, y: 0.75, w: WIDTH, h: 0.7, fontFace: FONT, fontSize: 26, bold: true, color: C.text });
  }
}

function render(pptx: PptxGenJS, s: Slide, index: number, total: number) {
  const slide = pptx.addSlide();
  switch (s.kind) {
    case "title": {
      chrome(slide, index, total);
      slide.addText(s.title.toUpperCase(), { x: MARGIN, y: 2.1, w: WIDTH, h: 0.4, fontFace: FONT, fontSize: 12, bold: true, color: C.critical, charSpacing: 3 });
      slide.addText(s.subtitle, { x: MARGIN, y: 2.6, w: WIDTH, h: 1, fontFace: FONT, fontSize: 40, bold: true, color: C.text });
      slide.addText(s.meta.join("\n"), { x: MARGIN, y: 3.8, w: WIDTH, h: 1.2, fontFace: FONT, fontSize: 14, color: C.muted, valign: "top" });
      return;
    }
    case "headline": {
      chrome(slide, index, total, s.title);
      slide.addShape(pptx.ShapeType.rect, { x: MARGIN, y: 1.75, w: 0.06, h: 1.5, fill: { color: TONE[s.tone] }, line: { color: TONE[s.tone] } });
      slide.addText(s.headline, { x: MARGIN + 0.25, y: 1.75, w: WIDTH - 0.25, h: 1.5, fontFace: FONT, fontSize: 22, color: C.text, valign: "middle" });
      const w = WIDTH / s.kpis.length;
      s.kpis.forEach((k, i) => {
        const x = MARGIN + i * w;
        slide.addShape(pptx.ShapeType.rect, { x: x + 0.05, y: 3.9, w: w - 0.2, h: 1.6, fill: { color: C.panel }, line: { color: C.rule } });
        slide.addText(k.label, { x: x + 0.25, y: 4.05, w: w - 0.6, h: 0.4, fontFace: FONT, fontSize: 12, color: C.muted });
        slide.addText(k.value, { x: x + 0.25, y: 4.5, w: w - 0.6, h: 0.8, fontFace: FONT, fontSize: 30, bold: true, color: k.tone ? TONE[k.tone] : C.metric });
      });
      return;
    }
    case "bullets": {
      chrome(slide, index, total, s.title);
      slide.addText(
        s.bullets.map((b) => ({ text: b, options: { bullet: s.numbered ? { type: "number" as const } : { code: "25AA" }, paraSpaceAfter: 14 } })),
        { x: MARGIN, y: 1.7, w: WIDTH, h: 4.9, fontFace: FONT, fontSize: 18, color: C.text, valign: "top" },
      );
      return;
    }
    case "table": {
      chrome(slide, index, total, s.title);
      const header = s.columns.map((c) => ({ text: c, options: { bold: true, color: C.muted, fill: { color: C.panel } } }));
      const body = s.rows.map((r) =>
        r.cells.map((cell, i) => ({ text: cell, options: { color: i === 2 && r.tone ? TONE[r.tone] : C.text } })),
      );
      const widthSum = s.widths.reduce((a, b) => a + b, 0);
      slide.addTable([header, ...body], {
        x: MARGIN,
        y: 1.7,
        w: WIDTH,
        colW: s.widths.map((w) => (w / widthSum) * WIDTH),
        fontFace: FONT,
        fontSize: 12,
        color: C.text,
        border: { type: "solid", pt: 0.75, color: C.rule },
        fill: { color: C.background },
        valign: "middle",
        rowH: 0.55,
      });
      if (s.note) slide.addText(s.note, { x: MARGIN, y: 6.4, w: WIDTH, h: 0.4, fontFace: FONT, fontSize: 11, italic: true, color: C.muted });
    }
  }
}

/** Renders the deck as a .pptx. `nodebuffer` is for tests; the app uses `blob`. */
export async function deckToPptx(deck: Deck, outputType: "blob" | "nodebuffer" = "blob"): Promise<Blob | Uint8Array> {
  const { default: Pptx } = await import("pptxgenjs");
  const pptx = new Pptx();
  pptx.layout = "LAYOUT_WIDE";
  pptx.title = deck.title;
  pptx.company = "BridgeGen";
  pptx.author = "BridgeGen";
  deck.slides.forEach((s, i) => render(pptx, s, i + 1, deck.slides.length));
  return (await pptx.write({ outputType })) as Blob | Uint8Array;
}
