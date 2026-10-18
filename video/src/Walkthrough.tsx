import { Fragment, type ComponentType } from "react";
import { AbsoluteFill } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { WALKTHROUGH_CHAPTERS } from "../../lib/walkthrough";
import { Close, ColdOpen } from "./scenes/bookends";
import { DECK_SLIDES, DeckBuild, DeckSlides, SLIDE_SECONDS } from "./scenes/deck";
import { RedTeam, RoomGaps, RoomMap } from "./scenes/room";
import { Present, SimRecap, SimToday, Statements } from "./scenes/simulator";
import { C } from "./theme";

export const FPS = 30;
const FADE_FRAMES = 15;

/** The shot list from WALKTHROUGH-SCRIPT.md, in seconds. */
export const SCENES: { id: string; seconds: number; component: ComponentType }[] = [
  { id: "cold-open", seconds: 12, component: ColdOpen },
  { id: "simulator-today", seconds: 12, component: SimToday },
  { id: "simulator-recap", seconds: 14, component: SimRecap },
  { id: "statements", seconds: 14, component: Statements },
  { id: "present", seconds: 9, component: Present },
  { id: "room-gaps", seconds: 20, component: RoomGaps },
  { id: "room-map", seconds: 18, component: RoomMap },
  { id: "red-team", seconds: 26, component: RedTeam },
  { id: "deck-build", seconds: 10, component: DeckBuild },
  { id: "deck-slides", seconds: 0.4 + DECK_SLIDES.length * SLIDE_SECONDS + 1.6, component: DeckSlides },
  { id: "close", seconds: 15, component: Close },
];

const frames = (seconds: number) => Math.round(seconds * FPS);

/** Crossfades overlap neighbouring scenes, so they shorten the total. */
export const DURATION_IN_FRAMES = SCENES.reduce((sum, s) => sum + frames(s.seconds), 0) - FADE_FRAMES * (SCENES.length - 1);

/** When each scene starts, in seconds, after the crossfades before it. */
export const SCENE_STARTS: Record<string, number> = Object.fromEntries(
  SCENES.map((s, i) => [s.id, (SCENES.slice(0, i).reduce((sum, p) => sum + frames(p.seconds), 0) - FADE_FRAMES * i) / FPS]),
);

// The /walkthrough page links chapters to these times: refuse to render a video they don't match.
for (const chapter of WALKTHROUGH_CHAPTERS) {
  const actual = SCENE_STARTS[chapter.sceneId];
  if (actual === undefined || Math.abs(actual - chapter.start) > 1e-6) {
    throw new Error(`Chapter "${chapter.title}" says ${chapter.start}s but scene "${chapter.sceneId}" starts at ${actual}s. Update lib/walkthrough.ts.`);
  }
}

export function Walkthrough() {
  return (
    <AbsoluteFill style={{ background: C.background }}>
      <TransitionSeries>
        {SCENES.map(({ id, seconds, component: SceneComponent }, i) => (
          <Fragment key={id}>
            {i > 0 && <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: FADE_FRAMES })} />}
            <TransitionSeries.Sequence durationInFrames={frames(seconds)} premountFor={FPS}>
              <SceneComponent />
            </TransitionSeries.Sequence>
          </Fragment>
        ))}
      </TransitionSeries>
    </AbsoluteFill>
  );
}
