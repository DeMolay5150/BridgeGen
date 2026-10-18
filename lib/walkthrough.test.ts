import { describe, expect, it } from "vitest";
import { WALKTHROUGH_CHAPTERS, formatTimestamp, walkthroughSources } from "./walkthrough";

describe("walkthrough", () => {
  it("serves from the public Supabase Storage bucket when Supabase is configured", () => {
    expect(walkthroughSources("https://abc.supabase.co/")).toEqual({
      video: "https://abc.supabase.co/storage/v1/object/public/media/walkthrough/walkthrough.mp4",
      poster: "https://abc.supabase.co/storage/v1/object/public/media/walkthrough/poster.png",
    });
  });

  it("falls back to the local render without Supabase", () => {
    for (const url of [null, undefined, ""]) {
      expect(walkthroughSources(url)).toEqual({ video: "/walkthrough.mp4", poster: "/walkthrough-poster.png" });
    }
  });

  it("lists chapters in order, starting at zero", () => {
    expect(WALKTHROUGH_CHAPTERS[0].start).toBe(0);
    for (let i = 1; i < WALKTHROUGH_CHAPTERS.length; i++) {
      expect(WALKTHROUGH_CHAPTERS[i].start).toBeGreaterThan(WALKTHROUGH_CHAPTERS[i - 1].start);
    }
  });

  it("formats timestamps as m:ss", () => {
    expect(formatTimestamp(0)).toBe("0:00");
    expect(formatTimestamp(58.5)).toBe("0:58");
    expect(formatTimestamp(121)).toBe("2:01");
  });
});
