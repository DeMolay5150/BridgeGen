import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { useSimulatorStore } from "../simulator/store";
import {
  colorFor,
  cursorSchema,
  displayName,
  peersFromPresence,
  stateSchema,
  throttle,
  topicFor,
  type Cursor,
  type Peer,
  type ViewId,
} from "./protocol";

const CURSOR_MS = 50;
const STATE_MS = 150;

export interface LiveRoomHandlers {
  onStatus: (status: "live" | "unavailable") => void;
  onPeers: (peers: Peer[]) => void;
  onCursor: (cursor: Cursor) => void;
}

export interface LiveRoomConnection {
  moveCursor: (x: number, y: number) => void;
  setView: (view: ViewId) => void;
  disconnect: () => void;
}

/** The parts of a Supabase client this module uses, so tests can supply a fake. */
export type RealtimeHost = Pick<SupabaseClient, "channel" | "removeChannel"> & {
  realtime: Pick<SupabaseClient["realtime"], "setAuth">;
};

/**
 * Joins a company's private channel: presence (who's here, on which page),
 * cursors, and the shared decision inputs (baseline, scenario, governance,
 * priorities), last write wins. Inbound messages are schema-checked and
 * merged over current values; edits received from colleagues aren't echoed.
 */
export function connectLiveRoom(
  supabase: RealtimeHost,
  { companyId, userId, email, view }: { companyId: string; userId: string; email?: string; view: ViewId },
  handlers: LiveRoomHandlers,
): LiveRoomConnection {
  let cancelled = false;
  let applyingRemote = false;
  let currentView = view;
  let subscribed = false;
  const me = { userId, name: displayName(email), color: colorFor(userId) };

  const channel: RealtimeChannel = supabase.channel(topicFor(companyId), {
    config: { private: true, presence: { key: userId }, broadcast: { self: false } },
  });

  const sendState = throttle(() => {
    const { baseline, scenario, governance, priorities } = useSimulatorStore.getState();
    void channel.send({ type: "broadcast", event: "state", payload: { userId, baseline, scenario, governance, priorities } });
  }, STATE_MS);
  const sendCursor = throttle((x: number, y: number) => {
    void channel.send({ type: "broadcast", event: "cursor", payload: { userId, x, y, view: currentView } });
  }, CURSOR_MS);

  channel
    .on("presence", { event: "sync" }, () => {
      handlers.onPeers(peersFromPresence(channel.presenceState() as Record<string, unknown[]>, userId));
    })
    .on("broadcast", { event: "cursor" }, ({ payload }) => {
      const cursor = cursorSchema.safeParse(payload);
      if (cursor.success && cursor.data.userId !== userId) handlers.onCursor(cursor.data);
    })
    .on("broadcast", { event: "state" }, ({ payload }) => {
      const message = stateSchema.safeParse(payload);
      if (!message.success || message.data.userId === userId) return;
      const { baseline, scenario, governance, priorities } = useSimulatorStore.getState();
      const incoming = message.data;
      applyingRemote = true;
      try {
        useSimulatorStore.setState({
          baseline: { ...baseline, ...incoming.baseline },
          scenario: { ...scenario, ...incoming.scenario },
          governance: { ...governance, ...incoming.governance },
          priorities: Object.fromEntries(
            Object.entries(priorities).map(([id, p]) => [id, { ...p, ...incoming.priorities[id] }]),
          ) as typeof priorities,
        });
      } finally {
        applyingRemote = false;
      }
    });

  // Zustand notifies subscribers synchronously inside setState, so the flag
  // above reliably marks changes that came from a colleague.
  const unsubscribe = useSimulatorStore.subscribe((state, prev) => {
    if (applyingRemote || state.companyId !== companyId) return;
    if (
      state.baseline !== prev.baseline ||
      state.scenario !== prev.scenario ||
      state.governance !== prev.governance ||
      state.priorities !== prev.priorities
    ) {
      sendState();
    }
  });

  void (async () => {
    // Private channels authorize with the signed-in user's JWT.
    await supabase.realtime.setAuth();
    if (cancelled) return;
    channel.subscribe((status) => {
      if (cancelled) return;
      if (status === "SUBSCRIBED") {
        subscribed = true;
        handlers.onStatus("live");
        void channel.track({ ...me, view: currentView });
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        // Usually: the realtime migration isn't applied, or the user isn't in the firm.
        handlers.onStatus("unavailable");
      }
    });
  })();

  return {
    moveCursor: (x, y) => sendCursor(x, y),
    setView: (next) => {
      currentView = next;
      if (subscribed) void channel.track({ ...me, view: next });
    },
    disconnect: () => {
      cancelled = true;
      unsubscribe();
      sendState.cancel();
      sendCursor.cancel();
      void supabase.removeChannel(channel);
    },
  };
}
