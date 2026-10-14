import { z } from "zod";
import { baselineSchema, governanceSchema, prioritiesSchema, scenarioSchema } from "../persistence/serialize";

/*
 * Wire protocol for live Decision Rooms. Everything that arrives from the
 * channel is untrusted (any firm member's browser can send anything), so
 * payloads are parsed with the same schemas as saved rows before use.
 */

/** One private channel per company; RLS on realtime.messages admits only its firm. */
export const topicFor = (companyId: string) => `company:${companyId}`;

/** Pages of the Decision Room a colleague can be on. */
export const VIEW_IDS = ["founder", "nextGen", "board", "lender", "facilitator", "map"] as const;
export type ViewId = (typeof VIEW_IDS)[number];

export interface Peer {
  userId: string;
  name: string;
  color: string;
  view: ViewId;
}

export interface Cursor {
  userId: string;
  /** Position as fractions of the shared surface, so screens of any size line up. */
  x: number;
  y: number;
  view: ViewId;
}

const uuid = z.uuid();
const fraction = z.number().min(0).max(1);
const view = z.enum(VIEW_IDS);

export const peerSchema = z.object({ userId: uuid, name: z.string().min(1).max(40), color: z.string().max(40), view });
export const cursorSchema = z.object({ userId: uuid, x: fraction, y: fraction, view });
/** The decision inputs colleagues edit together. Room answers are never synced. */
export const stateSchema = z.object({
  userId: uuid,
  baseline: baselineSchema,
  scenario: scenarioSchema,
  governance: governanceSchema,
  priorities: prioritiesSchema,
});
export type StateMessage = z.infer<typeof stateSchema>;

/** Cursor colours: the chart tokens, so they match the theme. */
const PALETTE = ["var(--metric)", "var(--positive)", "var(--caution)", "var(--critical)", "var(--chart-5)"];

/** A stable colour per person, so a colleague keeps theirs across reloads. */
export function colorFor(userId: string): string {
  let hash = 0;
  for (const char of userId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

/** "jordan.lee@firm.com" → "Jordan Lee". */
export function displayName(email: string | undefined): string {
  const local = (email ?? "").split("@")[0].replace(/[._+-]+/g, " ").trim();
  const name = local.replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 40);
  return name || "Colleague";
}

/**
 * Colleagues present, from Supabase's presence state (key → tracked metas,
 * one per open tab). Invalid entries and the viewer themself are dropped;
 * one entry per person, most recent tab winning.
 */
export function peersFromPresence(state: Record<string, unknown[]>, selfId: string): Peer[] {
  const byUser = new Map<string, Peer>();
  for (const metas of Object.values(state)) {
    for (const meta of metas) {
      const parsed = peerSchema.safeParse(meta);
      if (parsed.success && parsed.data.userId !== selfId) byUser.set(parsed.data.userId, parsed.data);
    }
  }
  return [...byUser.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Calls `fn` at most once per `ms`, always delivering the latest arguments. */
export function throttle<A extends unknown[]>(fn: (...args: A) => void, ms: number) {
  let last = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: A | null = null;
  const run = () => {
    last = Date.now();
    timer = undefined;
    const args = pending!;
    pending = null;
    fn(...args);
  };
  const throttled = (...args: A) => {
    pending = args;
    if (timer) return;
    const wait = Math.max(0, ms - (Date.now() - last));
    if (wait === 0) run();
    else timer = setTimeout(run, wait);
  };
  throttled.cancel = () => {
    clearTimeout(timer);
    timer = undefined;
    pending = null;
  };
  return throttled;
}
