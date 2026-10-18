import { Composition } from "remotion";
import { DURATION_IN_FRAMES, FPS, Walkthrough } from "./Walkthrough";

export function RemotionRoot() {
  return <Composition id="Walkthrough" component={Walkthrough} durationInFrames={DURATION_IN_FRAMES} fps={FPS} width={1920} height={1080} />;
}
