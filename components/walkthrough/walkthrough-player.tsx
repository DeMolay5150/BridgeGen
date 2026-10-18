"use client";

import { useRef, useState } from "react";
import { Play } from "lucide-react";
import { formatTimestamp, type WalkthroughChapter, type WalkthroughSources } from "@/lib/walkthrough";
import { cn } from "@/lib/utils";

/** The walkthrough video with chapters that seek it and follow along as it plays. */
export function WalkthroughPlayer({ sources, chapters }: { sources: WalkthroughSources; chapters: WalkthroughChapter[] }) {
  const video = useRef<HTMLVideoElement>(null);
  const [current, setCurrent] = useState(0);
  const [failed, setFailed] = useState(false);

  const seek = (start: number) => {
    const el = video.current;
    if (!el) return;
    el.currentTime = start;
    void el.play().catch(() => {});
  };

  // The last chapter whose start has passed.
  const onTimeUpdate = () => {
    const t = video.current?.currentTime ?? 0;
    const index = chapters.findLastIndex((c) => c.start <= t + 0.25);
    if (index !== current && index >= 0) setCurrent(index);
  };

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {failed ? (
          <div className="flex aspect-video items-center justify-center p-6 text-center text-sm text-muted-foreground">
            The video couldn&apos;t be loaded. Try again shortly.
          </div>
        ) : (
          <video
            ref={video}
            className="aspect-video w-full bg-background"
            controls
            playsInline
            preload="metadata"
            poster={sources.poster}
            onTimeUpdate={onTimeUpdate}
            onError={() => setFailed(true)}
            aria-label="BridgeGen product walkthrough"
          >
            <source src={sources.video} type="video/mp4" />
          </video>
        )}
      </div>

      <nav aria-label="Chapters" className="rounded-xl border border-border bg-card p-2">
        <ol className="grid gap-1">
          {chapters.map((chapter, i) => (
            <li key={chapter.sceneId}>
              <button
                type="button"
                onClick={() => seek(chapter.start)}
                disabled={failed}
                aria-current={i === current ? "step" : undefined}
                className={cn(
                  "group grid w-full grid-cols-[3rem_minmax(0,1fr)] gap-x-3 gap-y-0.5 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50",
                  i === current && "bg-muted",
                )}
              >
                <span className={cn("row-span-2 pt-0.5 font-mono text-xs", i === current ? "text-metric" : "text-muted-foreground")}>
                  {formatTimestamp(chapter.start)}
                </span>
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  {chapter.title}
                  <Play className="size-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
                </span>
                <span className="text-xs leading-5 text-muted-foreground">{chapter.summary}</span>
              </button>
            </li>
          ))}
        </ol>
      </nav>
    </div>
  );
}
