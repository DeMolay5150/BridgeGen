import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultSnapshot } from "../persistence/serialize";
import { useSimulatorStore } from "../simulator/store";
import { connectLiveRoom, type RealtimeHost } from "./live-room";

const COMPANY = "6f1c2a9e-1b2c-4d5e-8f90-123456789abc";
const ME = "11111111-1111-4111-8111-111111111111";
const COLLEAGUE = "22222222-2222-4222-8222-222222222222";

type Listener = (message: { payload: unknown }) => void;

/** A stand-in for a Supabase Realtime channel that records what we send and lets the test deliver messages. */
function fakeHost() {
  const listeners = new Map<string, Listener>();
  const sent: { event: string; payload: Record<string, unknown> }[] = [];
  const tracked: Record<string, unknown>[] = [];
  let subscribeCallback: ((status: string) => void) | null = null;
  let presence: Record<string, unknown[]> = {};
  const removed: unknown[] = [];

  const channel = {
    topic: "",
    options: {} as unknown,
    on(type: string, filter: { event: string }, cb: Listener) {
      listeners.set(`${type}:${filter.event}`, cb);
      return channel;
    },
    send: async (message: { event: string; payload: Record<string, unknown> }) => {
      sent.push(message);
      return "ok";
    },
    track: async (meta: Record<string, unknown>) => {
      tracked.push(meta);
      return "ok";
    },
    presenceState: () => presence,
    subscribe(cb: (status: string) => void) {
      subscribeCallback = cb;
      return channel;
    },
  };

  const host = {
    channel: (topic: string, options: unknown) => {
      channel.topic = topic;
      channel.options = options;
      return channel;
    },
    removeChannel: async (c: unknown) => {
      removed.push(c);
      return "ok";
    },
    realtime: { setAuth: async () => undefined },
  } as unknown as RealtimeHost;

  return {
    host,
    channel,
    sent,
    tracked,
    removed,
    deliver: (key: string, payload: unknown) => listeners.get(key)?.({ payload }),
    setPresence: (state: Record<string, unknown[]>) => {
      presence = state;
      listeners.get("presence:sync")?.({ payload: {} });
    },
    connect: async (status = "SUBSCRIBED") => {
      await Promise.resolve();
      await Promise.resolve();
      subscribeCallback?.(status);
    },
  };
}

const handlers = () => ({ onStatus: vi.fn(), onPeers: vi.fn(), onCursor: vi.fn() });

beforeEach(() => {
  vi.useFakeTimers();
  useSimulatorStore.setState({ ...defaultSnapshot(), companyId: COMPANY, companyName: "Hartwell" });
});
afterEach(() => vi.useRealTimers());

describe("connectLiveRoom", () => {
  it("joins the company's private channel and announces who and where we are", async () => {
    const fake = fakeHost();
    const h = handlers();
    connectLiveRoom(fake.host, { companyId: COMPANY, userId: ME, email: "jordan.lee@meridian.com", view: "map" }, h);
    expect(fake.channel.topic).toBe(`company:${COMPANY}`);
    expect(fake.channel.options).toMatchObject({ config: { private: true, presence: { key: ME } } });
    await fake.connect();
    expect(h.onStatus).toHaveBeenCalledWith("live");
    expect(fake.tracked).toEqual([{ userId: ME, name: "Jordan Lee", color: expect.any(String), view: "map" }]);
  });

  it("reports an unavailable channel (migration missing, or not in the firm)", async () => {
    const fake = fakeHost();
    const h = handlers();
    connectLiveRoom(fake.host, { companyId: COMPANY, userId: ME, view: "map" }, h);
    await fake.connect("CHANNEL_ERROR");
    expect(h.onStatus).toHaveBeenCalledWith("unavailable");
  });

  it("broadcasts local edits, throttled, with the latest values", async () => {
    const fake = fakeHost();
    connectLiveRoom(fake.host, { companyId: COMPANY, userId: ME, view: "map" }, handlers());
    await fake.connect();
    useSimulatorStore.getState().setScenario({ leverage: 2 });
    useSimulatorStore.getState().setScenario({ leverage: 3 });
    vi.advanceTimersByTime(200);
    const states = fake.sent.filter((m) => m.event === "state");
    expect(states.length).toBeLessThanOrEqual(2);
    expect((states.at(-1)!.payload.scenario as { leverage: number }).leverage).toBe(3);
  });

  it("applies a colleague's edits without echoing them back", async () => {
    const fake = fakeHost();
    connectLiveRoom(fake.host, { companyId: COMPANY, userId: ME, view: "map" }, handlers());
    await fake.connect();
    const { baseline, scenario, governance, priorities } = defaultSnapshot();
    fake.deliver("broadcast:state", {
      userId: COLLEAGUE,
      baseline: { ...baseline, revenue: 55 },
      scenario: { ...scenario, leverage: 4 },
      governance: { ...governance, votingRules: "yes" },
      priorities,
    });
    vi.advanceTimersByTime(500);
    const s = useSimulatorStore.getState();
    expect([s.baseline.revenue, s.scenario.leverage, s.governance.votingRules]).toEqual([55, 4, "yes"]);
    expect(fake.sent.filter((m) => m.event === "state")).toHaveLength(0);
  });

  it("ignores malformed state and our own messages", async () => {
    const fake = fakeHost();
    connectLiveRoom(fake.host, { companyId: COMPANY, userId: ME, view: "map" }, handlers());
    await fake.connect();
    const before = useSimulatorStore.getState().baseline;
    const { scenario, governance, priorities } = defaultSnapshot();
    fake.deliver("broadcast:state", { userId: COLLEAGUE, baseline: { revenue: "a lot" }, scenario, governance, priorities });
    fake.deliver("broadcast:state", { userId: ME, baseline: { revenue: 999 }, scenario, governance, priorities });
    fake.deliver("broadcast:state", { baseline: { revenue: 999 } });
    expect(useSimulatorStore.getState().baseline).toBe(before);
  });

  it("passes on valid cursors, drops bad ones, and sends ours with the current page", async () => {
    const fake = fakeHost();
    const h = handlers();
    const live = connectLiveRoom(fake.host, { companyId: COMPANY, userId: ME, view: "map" }, h);
    await fake.connect();
    fake.deliver("broadcast:cursor", { userId: COLLEAGUE, x: 0.4, y: 0.6, view: "facilitator" });
    fake.deliver("broadcast:cursor", { userId: COLLEAGUE, x: 4, y: 0.6, view: "facilitator" });
    expect(h.onCursor).toHaveBeenCalledTimes(1);
    live.setView("facilitator");
    live.moveCursor(0.25, 0.75);
    expect(fake.sent.at(-1)).toMatchObject({ event: "cursor", payload: { userId: ME, x: 0.25, y: 0.75, view: "facilitator" } });
    expect(fake.tracked.at(-1)).toMatchObject({ view: "facilitator" });
  });

  it("lists colleagues from presence, without us", async () => {
    const fake = fakeHost();
    const h = handlers();
    connectLiveRoom(fake.host, { companyId: COMPANY, userId: ME, view: "map" }, h);
    fake.setPresence({
      [ME]: [{ userId: ME, name: "Me", color: "x", view: "map" }],
      [COLLEAGUE]: [{ userId: COLLEAGUE, name: "Sam", color: "x", view: "board" }],
    });
    expect(h.onPeers).toHaveBeenLastCalledWith([{ userId: COLLEAGUE, name: "Sam", color: "x", view: "board" }]);
  });

  it("stops sending and leaves the channel on disconnect", async () => {
    const fake = fakeHost();
    const live = connectLiveRoom(fake.host, { companyId: COMPANY, userId: ME, view: "map" }, handlers());
    await fake.connect();
    live.disconnect();
    useSimulatorStore.getState().setScenario({ leverage: 5 });
    vi.advanceTimersByTime(500);
    expect(fake.sent).toHaveLength(0);
    expect(fake.removed).toHaveLength(1);
  });

  it("never broadcasts another company's edits", async () => {
    const fake = fakeHost();
    connectLiveRoom(fake.host, { companyId: COMPANY, userId: ME, view: "map" }, handlers());
    await fake.connect();
    useSimulatorStore.setState({ companyId: "99999999-9999-4999-8999-999999999999" });
    useSimulatorStore.getState().setScenario({ leverage: 5 });
    vi.advanceTimersByTime(500);
    expect(fake.sent).toHaveLength(0);
  });
});
