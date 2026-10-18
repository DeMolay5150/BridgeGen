import { AbsoluteFill } from "remotion";
import { C, MONO, SANS } from "../theme";
import { Caption, Card, FadeUp } from "../ui";

/** 0:00 cold open: wordmark, promise, the problem. */
export function ColdOpen() {
  return (
    <AbsoluteFill style={{ background: C.background, color: C.foreground, fontFamily: SANS, alignItems: "center", justifyContent: "center", gap: 40 }}>
      <FadeUp>
        <div style={{ fontFamily: MONO, fontSize: 64, letterSpacing: "0.32em", color: C.metric, paddingLeft: "0.32em" }}>BRIDGEGEN</div>
      </FadeUp>
      <FadeUp delay={0.8}>
        <div style={{ fontSize: 52, fontWeight: 600, letterSpacing: "-0.02em", textAlign: "center", maxWidth: 1300 }}>
          See the systemic consequences before you make the decision.
        </div>
      </FadeUp>
      <div style={{ position: "absolute", bottom: 110, left: 112, right: 112 }}>
        <Caption
          delay={2.5}
          text="Every recap, transfer and succession plan looks fine in a spreadsheet. The trouble starts when the family, the lender and the board react. BridgeGen shows you that before the client signs."
        />
      </div>
    </AbsoluteFill>
  );
}

/** 2:45 close: the three workflows and the call to action. */
export function Close() {
  const tiles = [
    ["Model it", "Scenario Simulator, linked statements, Monte Carlo"],
    ["Stress it", "Decision Room, Red Team, liquidity alerts"],
    ["Present it", "Client mode and one-click IC decks"],
  ];
  return (
    <AbsoluteFill style={{ background: C.background, color: C.foreground, fontFamily: SANS, padding: "0 112px", justifyContent: "center", gap: 56 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 32 }}>
        {tiles.map(([title, detail], i) => (
          <FadeUp key={title} delay={0.3 + i * 0.25} style={{ height: "100%" }}>
            <Card style={{ display: "grid", gap: 14, padding: 40, height: "100%", boxSizing: "border-box", alignContent: "start" }}>
              <div style={{ fontSize: 44, fontWeight: 600 }}>{title}</div>
              <div style={{ fontSize: 26, color: C.mutedForeground, lineHeight: 1.4 }}>{detail}</div>
            </Card>
          </FadeUp>
        ))}
      </div>
      <FadeUp delay={1.4} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontFamily: MONO, fontSize: 32, color: C.metric }}>bridgegen.io/walkthrough</div>
        <span style={{ padding: "18px 34px", borderRadius: 14, fontSize: 30, fontWeight: 500, background: C.foreground, color: C.background }}>
          Book a partnership call
        </span>
      </FadeUp>
      <FadeUp delay={2.2}>
        <div style={{ fontSize: 40, fontWeight: 600, letterSpacing: "-0.02em" }}>Model it. Stress it. Present it. BridgeGen.</div>
      </FadeUp>
    </AbsoluteFill>
  );
}
