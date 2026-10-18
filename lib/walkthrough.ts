/*
 * The product walkthrough video: where it's hosted and its chapters. The MP4
 * is rendered by video/ and uploaded to Supabase Storage (`pnpm video:upload`),
 * never committed (re-renders would bloat git history).
 */

/** Public Supabase Storage bucket and object paths the upload script writes. */
export const WALKTHROUGH_BUCKET = "media";
export const WALKTHROUGH_VIDEO_PATH = "walkthrough/walkthrough.mp4";
export const WALKTHROUGH_POSTER_PATH = "walkthrough/poster.png";
/** Re-renders overwrite the same path, so keep CDN caching short. */
export const WALKTHROUGH_CACHE_SECONDS = 300;

export interface WalkthroughSources {
  video: string;
  poster: string;
}

/**
 * Where the page loads the video from: the Supabase Storage public URL when
 * Supabase is configured, else the local render in public/ (demo deployments
 * and offline development).
 */
export function walkthroughSources(supabaseUrl: string | null | undefined): WalkthroughSources {
  const base = supabaseUrl?.replace(/\/+$/, "");
  if (!base) return { video: "/walkthrough.mp4", poster: "/walkthrough-poster.png" };
  const object = (path: string) => `${base}/storage/v1/object/public/${WALKTHROUGH_BUCKET}/${path}`;
  return { video: object(WALKTHROUGH_VIDEO_PATH), poster: object(WALKTHROUGH_POSTER_PATH) };
}

export interface WalkthroughChapter {
  title: string;
  summary: string;
  /** The video scene the chapter opens on (video/src/Walkthrough.tsx). */
  sceneId: string;
  /** Start time in seconds. The video render fails if this drifts from the scene's real start. */
  start: number;
}

export const WALKTHROUGH_CHAPTERS: WalkthroughChapter[] = [
  { title: "The problem", summary: "Why spreadsheets miss the family, lender and board reaction.", sceneId: "cold-open", start: 0 },
  { title: "Scenario Simulator", summary: "A 4x recap, linked statements, Monte Carlo and client mode.", sceneId: "simulator-today", start: 11.5 },
  { title: "Decision Room & Red Team", summary: "Private stakeholder views, the ownership map and stress tests.", sceneId: "room-gaps", start: 58.5 },
  { title: "One-click IC deck", summary: "Eleven slides, every figure traceable to the model.", sceneId: "deck-build", start: 121 },
  { title: "Model it. Stress it. Present it.", summary: "The three workflows, and how to start.", sceneId: "close", start: 160 },
];

/** 75 → "1:15". */
export function formatTimestamp(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
