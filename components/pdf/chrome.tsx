import { Text, View } from "@react-pdf/renderer";
import { pdfText as t } from "@/lib/report/pdf-text";

/*
 * Page furniture shared by every BridgeGen PDF: running header, numbered
 * footer and an optional watermark. Each is `fixed`, so it repeats on every
 * page it's placed in.
 *
 * Never give these (or the Page) an inherited lineHeight: react-pdf renders
 * nothing for a page-number `render` text that inherits one (tasks/lessons.md).
 */

export type Watermark = "none" | "confidential" | "draft" | "client";

export const WATERMARKS: { id: Watermark; label: string }[] = [
  { id: "none", label: "None" },
  { id: "confidential", label: "Confidential" },
  { id: "draft", label: "Draft" },
  { id: "client", label: "Client copy" },
];

const WATERMARK_TEXT: Record<Exclude<Watermark, "none">, string> = {
  confidential: "CONFIDENTIAL",
  draft: "DRAFT",
  client: "CLIENT COPY",
};

export interface ChromePalette {
  accent: string;
  muted: string;
  rule: string;
  /** Watermark ink; keep it faint against the page. */
  watermark: string;
}

export const PRINT_PALETTE: ChromePalette = { accent: "#0891b2", muted: "#64748b", rule: "#e2e8f0", watermark: "#0f172a" };
export const SCREEN_PALETTE: ChromePalette = { accent: "#22d3ee", muted: "#94a3b8", rule: "#1e293b", watermark: "#f8fafc" };

/** "BridgeGen · Draft · Prepared for Hartwell"; the classification follows the watermark. */
export function footerText(company: string, watermark: Watermark): string {
  const classification = watermark === "none" ? null : WATERMARKS.find((w) => w.id === watermark)!.label;
  return ["BridgeGen", classification, `Prepared for ${company}`].filter(Boolean).join(" · ");
}

/** Wordmark left; document and company right. Sits in the page's top margin. */
export function RunningHeader({ title, company, palette, inset }: { title: string; company: string; palette: ChromePalette; inset: number }) {
  return (
    <View
      fixed
      style={{
        position: "absolute",
        top: 18,
        left: inset,
        right: inset,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        fontSize: 7.5,
        color: palette.muted,
      }}
    >
      <Text style={{ color: palette.accent, fontFamily: "Helvetica-Bold", letterSpacing: 2.5 }}>BRIDGEGEN</Text>
      <Text>{t(`${title} · ${company}`)}</Text>
    </View>
  );
}

/** "BridgeGen · Confidential · Prepared for X" on the left, "n / total" on the right. */
export function Footer({ left, palette, inset }: { left: string; palette: ChromePalette; inset: number }) {
  return (
    <View
      fixed
      style={{
        position: "absolute",
        bottom: 22,
        left: inset,
        right: inset,
        flexDirection: "row",
        justifyContent: "space-between",
        fontSize: 7.5,
        color: palette.muted,
        borderTopWidth: 1,
        borderColor: palette.rule,
        paddingTop: 6,
      }}
    >
      <Text>{t(left)}</Text>
      <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );
}

/** Diagonal watermark across the middle of every page; nothing for "none". (No letterSpacing: it splits the word into glyphs.) */
export function WatermarkMark({ kind, palette }: { kind: Watermark; palette: ChromePalette }) {
  if (kind === "none") return null;
  return (
    <View fixed style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, justifyContent: "center", alignItems: "center" }}>
      <Text
        style={{
          fontSize: 72,
          fontFamily: "Helvetica-Bold",
          color: palette.watermark,
          opacity: 0.06,
          transform: "rotate(-30deg)",
        }}
      >
        {WATERMARK_TEXT[kind]}
      </Text>
    </View>
  );
}
