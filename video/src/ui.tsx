import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Severity } from "../../lib/simulator/types";
import { C, MONO, SANS, TONE, wash } from "./theme";

/** 0 → 1 spring starting `delay` seconds into the current sequence. */
export function useEnter(delay = 0, damping = 200) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay * fps, fps, config: { damping } });
}

/** 0 → 1 linear progress between two times (seconds) in the current sequence, clamped. */
export function useProgress(from: number, to: number) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return interpolate(frame, [from * fps, to * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
}

export function FadeUp({ delay = 0, children, style }: { delay?: number; children: ReactNode; style?: CSSProperties }) {
  const p = useEnter(delay);
  return <div style={{ opacity: p, transform: `translateY(${(1 - p) * 24}px)`, ...style }}>{children}</div>;
}

/** Full-frame scene: eyebrow + title on top, content, and the voice-over line as a caption. */
export function Scene({ eyebrow, title, caption, captionAt = 0.6, children }: { eyebrow: string; title: string; caption?: string; captionAt?: number; children: ReactNode }) {
  return (
    <AbsoluteFill style={{ background: C.background, color: C.foreground, fontFamily: SANS, padding: "84px 112px 0" }}>
      <FadeUp>
        <div style={{ fontFamily: MONO, fontSize: 20, letterSpacing: "0.2em", textTransform: "uppercase", color: C.metric }}>{eyebrow}</div>
        <div style={{ fontSize: 56, fontWeight: 600, letterSpacing: "-0.02em", marginTop: 12 }}>{title}</div>
      </FadeUp>
      <div style={{ flex: 1, marginTop: 44, minHeight: 0 }}>{children}</div>
      <div style={{ height: 150, display: "flex", alignItems: "center" }}>{caption && <Caption text={caption} delay={captionAt} />}</div>
    </AbsoluteFill>
  );
}

/** The voice-over line, on screen so the video works muted (autoplay, LinkedIn, email). */
export function Caption({ text, delay = 0 }: { text: string; delay?: number }) {
  const p = useEnter(delay);
  return (
    <div
      style={{
        opacity: p,
        borderLeft: `3px solid ${C.metric}`,
        paddingLeft: 24,
        fontSize: 28,
        lineHeight: 1.4,
        color: C.mutedForeground,
        // Two lines at most for the longest voice-over line, clear of the bottom edge.
        maxWidth: 1696,
      }}
    >
      {text}
    </div>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 32, ...style }}>{children}</div>
  );
}

export function Label({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ fontSize: 22, color: C.mutedForeground, ...style }}>{children}</div>;
}

export function Badge({ tone, children }: { tone: Severity | "neutral"; children: ReactNode }) {
  const color = tone === "neutral" ? C.mutedForeground : TONE[tone];
  return (
    <span
      style={{
        display: "inline-block",
        flexShrink: 0,
        alignSelf: "center",
        whiteSpace: "nowrap",
        fontFamily: MONO,
        fontSize: 20,
        padding: "6px 14px",
        borderRadius: 999,
        color,
        background: tone === "neutral" ? C.muted : wash(color),
      }}
    >
      {children}
    </span>
  );
}

export function Kpi({ label, value, tone, badge, badgeTone = "neutral" }: { label: string; value: string; tone?: string; badge?: string; badgeTone?: Severity | "neutral" }) {
  return (
    <Card style={{ display: "grid", gap: 14 }}>
      <Label>{label}</Label>
      <div style={{ fontFamily: MONO, fontSize: 60, fontWeight: 500, color: tone ?? C.metric, letterSpacing: "-0.02em" }}>{value}</div>
      <div style={{ minHeight: 36 }}>{badge && <Badge tone={badgeTone}>{badge}</Badge>}</div>
    </Card>
  );
}

/** A slider drawn at `fraction` of its track (driven by the scene's frame). */
export function Slider({ label, display, fraction }: { label: string; display: string; fraction: number }) {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 26 }}>
        <span>{label}</span>
        <span style={{ fontFamily: MONO, color: C.metric }}>{display}</span>
      </div>
      <div style={{ position: "relative", height: 8, borderRadius: 4, background: C.muted }}>
        <div style={{ position: "absolute", inset: 0, width: `${fraction * 100}%`, borderRadius: 4, background: C.foreground }} />
        <div
          style={{
            position: "absolute",
            left: `calc(${fraction * 100}% - 14px)`,
            top: -10,
            width: 28,
            height: 28,
            borderRadius: 14,
            background: C.foreground,
            boxShadow: `0 0 0 6px ${wash(C.foreground, 0.15)}`,
          }}
        />
      </div>
    </div>
  );
}
