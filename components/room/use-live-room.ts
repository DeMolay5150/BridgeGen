"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { connectLiveRoom, type LiveRoomConnection } from "@/lib/realtime/live-room";
import type { Cursor, Peer, ViewId } from "@/lib/realtime/protocol";
import { useSessionStore } from "@/lib/session/store";
import { useSimulatorStore } from "@/lib/simulator/store";
import { getBrowserClient } from "@/lib/supabase/client";

export type LiveStatus = "off" | "connecting" | "live" | "unavailable";

/** Cursors that stop moving fade out after this long. */
export const CURSOR_TTL_MS = 8_000;

/**
 * React adapter for `connectLiveRoom`: live only for a saved company with a
 * signed-in advisor. Firm membership is enforced by RLS on the channel.
 */
export function useLiveRoom(view: ViewId) {
  const companyId = useSimulatorStore((s) => s.companyId);
  const user = useSessionStore((s) => s.user);
  const userId = user?.id ?? null;
  const email = user?.email;

  // Set only from channel callbacks, tagged with the channel it describes; "off" and "connecting" are derived.
  const [connection, setConnection] = useState<{ key: string; status: "live" | "unavailable" } | null>(null);
  const [peers, setPeers] = useState<{ key: string; list: Peer[] }>({ key: "", list: [] });
  const [cursors, setCursors] = useState<{ key: string; byUser: Record<string, Cursor & { at: number }> }>({ key: "", byUser: {} });
  const live = useRef<LiveRoomConnection | null>(null);
  const viewRef = useRef(view);

  const channelKey = companyId && userId && getBrowserClient() ? `${companyId}:${userId}` : null;

  useEffect(() => {
    const supabase = getBrowserClient();
    if (!supabase || !companyId || !userId) return;
    const key = `${companyId}:${userId}`;
    const connected = connectLiveRoom(
      supabase,
      { companyId, userId, email, view: viewRef.current },
      {
        onStatus: (status) => setConnection({ key, status }),
        onPeers: (list) => {
          setPeers({ key, list });
          // Drop the cursors of people who left.
          setCursors((current) => ({
            key,
            byUser: Object.fromEntries(Object.entries(current.byUser).filter(([id]) => list.some((p) => p.userId === id))),
          }));
        },
        onCursor: (cursor) =>
          setCursors((current) => ({
            key,
            byUser: { ...(current.key === key ? current.byUser : {}), [cursor.userId]: { ...cursor, at: Date.now() } },
          })),
      },
    );
    live.current = connected;
    return () => {
      connected.disconnect();
      live.current = null;
    };
  }, [companyId, userId, email]);

  // Tell colleagues which page we're on.
  useEffect(() => {
    viewRef.current = view;
    live.current?.setView(view);
  }, [view]);

  const moveCursor = useCallback((x: number, y: number) => live.current?.moveCursor(x, y), []);

  // State from a previous company or user is ignored rather than cleared.
  return {
    status: (!channelKey ? "off" : connection?.key === channelKey ? connection.status : "connecting") as LiveStatus,
    peers: peers.key === channelKey ? peers.list : [],
    cursors: cursors.key === channelKey ? cursors.byUser : {},
    moveCursor,
  };
}
