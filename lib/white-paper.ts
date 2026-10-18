import { Marked } from "marked";

/*
 * The white paper is written once, in docs/white-paper.md, and rendered by
 * /white-paper. The source is our own committed file (never user input), so
 * its HTML is trusted.
 */

export interface PaperSection {
  id: string;
  title: string;
}

export interface Paper {
  title: string;
  /** Rendered HTML of everything after the title line. */
  html: string;
  /** Second-level headings, in order, for the table of contents. */
  sections: PaperSection[];
}

/** URL fragment for a heading: "4. Secure multi-tenant firm architecture" → "4-secure-multi-tenant-firm-architecture". */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/&[a-z]+;/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function renderPaper(markdown: string): Paper {
  const match = markdown.match(/^#\s+(.+)\r?\n/);
  if (!match) throw new Error("white paper must start with a '# Title' line");
  const title = match[1].replace(/^BridgeGen:\s*/, "").trim();

  const sections: PaperSection[] = [];
  const used = new Set<string>();
  const marked = new Marked({ gfm: true });
  marked.use({
    renderer: {
      heading({ tokens, depth, text }) {
        const inner = this.parser.parseInline(tokens);
        let id = slugify(text) || "section";
        for (let n = 2; used.has(id); n++) id = `${slugify(text)}-${n}`;
        used.add(id);
        if (depth === 2) sections.push({ id, title: text });
        return `<h${depth} id="${id}">${inner}</h${depth}>\n`;
      },
      link({ href, tokens }) {
        const inner = this.parser.parseInline(tokens);
        const external = /^https?:\/\//.test(href) && !href.startsWith("https://www.bridgegen.io");
        return external
          ? `<a href="${href}" target="_blank" rel="noopener noreferrer">${inner}</a>`
          : `<a href="${href}">${inner}</a>`;
      },
      // Wide tables scroll inside their own box instead of the page.
      table(token) {
        const header = token.header.map((cell) => `<th>${this.parser.parseInline(cell.tokens)}</th>`).join("");
        const rows = token.rows
          .map((row) => `<tr>${row.map((cell) => `<td>${this.parser.parseInline(cell.tokens)}</td>`).join("")}</tr>`)
          .join("\n");
        return `<div class="paper-table"><table><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table></div>\n`;
      },
    },
  });

  const html = marked.parse(markdown.slice(match[0].length), { async: false });
  return { title, html, sections };
}
