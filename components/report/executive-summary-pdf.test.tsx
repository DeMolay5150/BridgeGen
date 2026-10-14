import { inflateSync } from "node:zlib";
import { renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";
import { defaultSnapshot } from "@/lib/persistence/serialize";
import { REPORT_SECTIONS, buildReport, type ReportSectionId } from "@/lib/report/build";
import { detectGaps } from "@/lib/room/gaps";
import { DEMO_RESPONSES } from "@/lib/room/topics";
import { footerText, type Watermark } from "@/components/pdf/chrome";
import { ExecutiveSummaryDocument } from "./executive-summary-pdf";

/** Each page's decompressed content stream (react-pdf writes one per page). */
function pageStreams(pdf: Buffer): string[] {
  return [...pdf.toString("latin1").matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)].map((m) => {
    try {
      return inflateSync(Buffer.from(m[1], "latin1")).toString("latin1");
    } catch {
      return "";
    }
  });
}

/** Standard-font text is written as hex-encoded WinAnsi strings. */
const hex = (text: string) => Buffer.from(text, "latin1").toString("hex");

async function render(sections: ReportSectionId[], watermark: Watermark = "none") {
  const report = buildReport({
    companyName: "Hartwell Family Holdings",
    preparedBy: "Jordan Lee",
    snapshot: defaultSnapshot(),
    gaps: detectGaps(DEMO_RESPONSES),
    sections,
    generatedAt: new Date("2026-10-14T12:00:00Z"),
  });
  return renderToBuffer(<ExecutiveSummaryDocument report={report} watermark={watermark} />);
}

describe("ExecutiveSummaryDocument", () => {
  it("renders a cover plus one page per section, each with a numbered footer", async () => {
    const pdf = await render(REPORT_SECTIONS.map((s) => s.id));
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    const pages = pageStreams(pdf);
    expect(pages).toHaveLength(5);
    // Regression: a page-level lineHeight silently dropped the fixed footer.
    pages.forEach((stream, i) => expect(stream).toContain(hex(`${i + 1} / 5`)));
  }, 30_000);

  it("watermarks every page when asked, and names the classification in the footer", async () => {
    const pages = pageStreams(await render(["governance", "room"], "draft"));
    pages.forEach((stream) => expect(stream).toContain(hex("DRAFT")));
    expect(footerText("Hartwell", "draft")).toBe("BridgeGen · Draft · Prepared for Hartwell");
    expect(footerText("Hartwell", "none")).toBe("BridgeGen · Prepared for Hartwell");
    pageStreams(await render(["governance"])).forEach((stream) => expect(stream).not.toContain(hex("DRAFT")));
  }, 30_000);

  it("leaves out unchosen sections", async () => {
    expect(pageStreams(await render(["governance"]))).toHaveLength(2);
  }, 30_000);
});
