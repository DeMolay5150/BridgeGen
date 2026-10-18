import { Sequence, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { Slide } from "../../../lib/deck/redteam";
import { deck } from "../data";
import { C, MONO, TONE, wash } from "../theme";
import { Badge, Card, FadeUp, Label, Scene, useEnter, useProgress } from "../ui";

/** The slides shown, in order (titles from lib/deck/ic.ts). */
const SHOWN = [
  "Bottom line",
  "The decision against today",
  "Ten-year financial summary",
  "Range of outcomes",
  "Liquidity & covenants",
  "Stress scenarios",
  "Recommended actions",
];
export const SLIDE_SECONDS = 4;
export const DECK_SLIDES = SHOWN.map((title) => deck.slides.find((s) => s.title === title)).filter((s): s is Slide => !!s);

function Choice({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      style={{
        padding: "14px 24px",
        borderRadius: 12,
        fontSize: 26,
        border: `1px solid ${active ? C.metric : C.border}`,
        background: active ? wash(C.metric, 0.12) : "transparent",
        color: active ? C.foreground : C.mutedForeground,
      }}
    >
      {label}
    </span>
  );
}

/** Shot 8: Simulator header → IC deck dialog. */
export function DeckBuild() {
  const picked = useProgress(2.5, 2.8) > 0.5;
  const clicked = useProgress(5, 5.3);
  const press = 1 - 0.04 * Math.sin(Math.PI * clicked);
  return (
    <Scene eyebrow="IC deck" title="One click to committee" caption="When it's time to take it to committee, one click builds the deck." captionAt={1}>
      <FadeUp delay={0.3} style={{ display: "flex", justifyContent: "center" }}>
        <Card style={{ width: 1100, display: "grid", gap: 30, padding: 44 }}>
          <div style={{ fontSize: 36, fontWeight: 600 }}>Investment committee deck</div>
          <Label>
            {deck.slides.length} slides from the live model{deck.slides.some((s) => s.title === "Stakeholder alignment") ? ", including Decision Room alignment" : ""}.
          </Label>
          <div style={{ display: "grid", gap: 14 }}>
            <Label>Watermark</Label>
            <div style={{ display: "flex", gap: 14 }}>
              <Choice label="Confidential" active={!picked} />
              <Choice label="Draft" active={false} />
              <Choice label="Client copy" active={picked} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 14 }}>
            <span
              style={{
                transform: `scale(${press})`,
                padding: "16px 30px",
                borderRadius: 12,
                fontSize: 26,
                fontWeight: 500,
                background: C.foreground,
                color: C.background,
                boxShadow: clicked > 0 ? `0 0 0 ${8 * clicked}px ${wash(C.foreground, 0.15)}` : undefined,
              }}
            >
              PowerPoint
            </span>
            <Choice label="PDF" active={false} />
            <Choice label="Marp" active={false} />
          </div>
        </Card>
      </FadeUp>
    </Scene>
  );
}

function SlideView({ slide }: { slide: Slide }) {
  return (
    <div
      style={{
        width: 1440,
        height: 810,
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 24,
        padding: 64,
        display: "flex",
        flexDirection: "column",
        gap: 36,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ fontFamily: MONO, fontSize: 18, letterSpacing: "0.2em", textTransform: "uppercase", color: C.metric }}>
        {deck.kind} · {deck.company}
      </div>
      <div style={{ fontSize: 48, fontWeight: 600, letterSpacing: "-0.02em" }}>{slide.title}</div>
      {slide.kind === "headline" && (
        <>
          <div style={{ fontSize: 32, lineHeight: 1.4, color: TONE[slide.tone] }}>{slide.headline}</div>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(slide.kpis.length, 4)}, 1fr)`, gap: 20, marginTop: "auto" }}>
            {slide.kpis.slice(0, 4).map((k) => (
              <div key={k.label} style={{ display: "grid", gap: 8, padding: 22, borderRadius: 16, background: C.background }}>
                <span style={{ fontSize: 20, color: C.mutedForeground }}>{k.label}</span>
                <span style={{ fontFamily: MONO, fontSize: 38, color: k.tone ? TONE[k.tone] : C.metric }}>{k.value}</span>
              </div>
            ))}
          </div>
        </>
      )}
      {slide.kind === "bullets" && (
        <ol style={{ margin: 0, paddingLeft: 36, display: "grid", gap: 18, fontSize: 28, lineHeight: 1.4, listStyleType: slide.numbered ? "decimal" : "disc" }}>
          {slide.bullets.slice(0, 6).map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ol>
      )}
      {slide.kind === "table" && (
        <>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 24, tableLayout: "fixed" }}>
            <colgroup>
              {slide.widths.map((w, i) => (
                <col key={i} style={{ width: `${(w / slide.widths.reduce((a, b) => a + b, 0)) * 100}%` }} />
              ))}
            </colgroup>
            <thead>
              <tr style={{ color: C.mutedForeground }}>
                {slide.columns.map((c, i) => (
                  <th key={i} style={{ textAlign: i === 0 ? "left" : "right", fontWeight: 400, paddingBottom: 12 }}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slide.rows.slice(0, 7).map((row, r) => (
                <tr key={r} style={{ borderTop: `1px solid ${C.border}` }}>
                  {row.cells.map((cell, i) => (
                    <td
                      key={i}
                      style={{
                        padding: "14px 0",
                        textAlign: i === 0 ? "left" : "right",
                        fontFamily: i === 0 ? undefined : MONO,
                        color: row.tone && i === slide.toneColumn ? TONE[row.tone] : C.foreground,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: i === 0 ? "nowrap" : undefined,
                      }}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {slide.note && <div style={{ marginTop: "auto", fontSize: 20, color: C.mutedForeground }}>{slide.note}</div>}
        </>
      )}
      <div style={{ position: "absolute", right: 48, bottom: 28, fontFamily: MONO, fontSize: 16, color: C.mutedForeground }}>Client copy</div>
    </div>
  );
}

function SlideShot({ slide }: { slide: Slide }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = useEnter(0);
  const exit = interpolate(frame, [(SLIDE_SECONDS - 0.4) * fps, SLIDE_SECONDS * fps], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", justifyContent: "center", opacity: Math.min(enter, exit), transform: `translateX(${(1 - enter) * 40}px)` }}>
      <div style={{ transform: "scale(0.82)", transformOrigin: "top center" }}>
        <SlideView slide={slide} />
      </div>
    </div>
  );
}

/** Shot 9: the deck, slide by slide. */
export function DeckSlides() {
  const { fps } = useVideoConfig();
  return (
    <Scene
      eyebrow="IC deck"
      title={`${deck.slides.length} slides, every figure traceable`}
      caption="Every figure traceable to the model, in PowerPoint, PDF or Marp. The Decision Room adds the alignment slide, never anyone's answers."
      captionAt={2}
    >
      <div style={{ position: "relative", height: "100%" }}>
        {DECK_SLIDES.map((slide, i) => (
          <Sequence key={slide.title} from={Math.round(0.4 * fps + i * SLIDE_SECONDS * fps)} durationInFrames={SLIDE_SECONDS * fps} premountFor={fps}>
            <SlideShot slide={slide} />
          </Sequence>
        ))}
      </div>
    </Scene>
  );
}
