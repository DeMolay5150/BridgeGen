"use client";

import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import type { Cursor, Peer, ViewId } from "@/lib/realtime/protocol";
import { STAKEHOLDER_LABELS, type StakeholderId } from "@/lib/simulator/alignment";
import { cn } from "@/lib/utils";
import { CURSOR_TTL_MS, type LiveStatus } from "./use-live-room";

const VIEW_LABEL = (view: ViewId) =>
  view === "facilitator" ? "Facilitator" : view === "map" ? "Map" : STAKEHOLDER_LABELS[view as StakeholderId];

const initials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

/** Who else is in this Decision Room, and on which page. */
export function PresenceBar({ status, peers }: { status: LiveStatus; peers: Peer[] }) {
  if (status === "off") return null;
  if (status === "unavailable") {
    return <p className="text-xs text-muted-foreground">Live collaboration isn&apos;t available for this company yet.</p>;
  }
  return (
    <div className="flex items-center gap-3" aria-live="polite">
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className={cn("size-1.5 rounded-full", status === "live" ? "animate-pulse bg-positive motion-reduce:animate-none" : "bg-caution")} aria-hidden />
        {status === "live" ? (peers.length ? "Live" : "Live · only you") : "Connecting…"}
      </span>
      {peers.length > 0 && (
        <ul className="flex -space-x-1.5" aria-label="Colleagues here">
          {peers.map((p) => (
            <li
              key={p.userId}
              title={`${p.name} · ${VIEW_LABEL(p.view)}`}
              className="flex size-7 items-center justify-center rounded-full border-2 border-background font-mono text-[0.625rem] font-medium text-background"
              style={{ background: p.color }}
            >
              <span aria-hidden>{initials(p.name)}</span>
              <span className="sr-only">
                {p.name}, on {VIEW_LABEL(p.view)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Shared surface: reports this user's pointer and draws colleagues' cursors
 * on the same page, positioned as fractions so different screens line up.
 */
export function LiveCursors({
  view,
  cursors,
  peers,
  onMove,
  children,
}: {
  view: ViewId;
  cursors: Record<string, Cursor & { at: number }>;
  peers: Peer[];
  onMove: (x: number, y: number) => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // 0 until the first tick: no clock reads during prerender, and cursors only exist once live.
  const [now, setNow] = useState(0);

  // Re-render every couple of seconds so idle cursors fade out.
  useEffect(() => {
    if (Object.keys(cursors).length === 0) return;
    const timer = setInterval(() => setNow(Date.now()), 2_000);
    return () => clearInterval(timer);
  }, [cursors]);

  const move = (event: PointerEvent<HTMLDivElement>) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box || box.width === 0 || box.height === 0) return;
    const x = (event.clientX - box.left) / box.width;
    const y = (event.clientY - box.top) / box.height;
    if (x >= 0 && x <= 1 && y >= 0 && y <= 1) onMove(x, y);
  };

  const visible = Object.values(cursors).filter((c) => c.view === view && now - c.at < CURSOR_TTL_MS);
  return (
    <div ref={ref} className="relative" onPointerMove={move}>
      {children}
      <div className="pointer-events-none absolute inset-0 z-40 overflow-hidden" aria-hidden>
        {visible.map((c) => {
          const peer = peers.find((p) => p.userId === c.userId);
          if (!peer) return null;
          return (
            <div
              key={c.userId}
              className="absolute transition-[left,top] duration-75 ease-linear"
              style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%` }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" className="-translate-x-px -translate-y-px drop-shadow">
                <path d="M1 1l5.5 13 1.9-5.6L14 6.5z" fill={peer.color} stroke="var(--background)" strokeWidth="1" />
              </svg>
              <span
                className="ml-3 rounded px-1.5 py-0.5 font-sans text-[0.6875rem] whitespace-nowrap text-background"
                style={{ background: peer.color }}
              >
                {peer.name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
