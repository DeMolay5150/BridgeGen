import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderPaper, slugify } from "./white-paper";

describe("slugify", () => {
  it("makes stable URL fragments", () => {
    expect(slugify("4. Secure multi-tenant firm architecture")).toBe("4-secure-multi-tenant-firm-architecture");
    expect(slugify("Appendix A: Migration history")).toBe("appendix-a-migration-history");
    expect(slugify("Data &amp; <code>RLS</code>")).toBe("data-rls");
  });
});

describe("renderPaper", () => {
  const sample = "# BridgeGen: Sample Paper\n\nIntro.\n\n## 1. One\n\n### Detail\n\n## 1. One\n\n| A | B |\n| --- | --- |\n| `x` | [ext](https://example.com) |\n";

  it("takes the title from the first line and drops it from the body", () => {
    const paper = renderPaper(sample);
    expect(paper.title).toBe("Sample Paper");
    expect(paper.html).not.toContain("<h1");
  });

  it("lists second-level headings with unique ids", () => {
    const paper = renderPaper(sample);
    expect(paper.sections).toEqual([
      { id: "1-one", title: "1. One" },
      { id: "1-one-2", title: "1. One" },
    ]);
    expect(paper.html).toContain('<h3 id="detail">');
  });

  it("wraps tables for horizontal scroll and opens external links safely", () => {
    const { html } = renderPaper(sample);
    expect(html).toContain('<div class="paper-table"><table>');
    expect(html).toContain("<code>x</code>");
    expect(html).toContain('href="https://example.com" target="_blank" rel="noopener noreferrer"');
  });

  it("renders the committed white paper", () => {
    const paper = renderPaper(readFileSync("docs/white-paper.md", "utf8"));
    expect(paper.title).toBe("Technical and Architectural White Paper");
    expect(paper.sections.map((s) => s.title)).toContain("9. Known limitations and open items");
    expect(paper.html).toContain('<a href="https://www.bridgegen.io">');
  });
});
