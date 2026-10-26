import { z } from "zod";
import { STAKEHOLDER_IDS, STAKEHOLDER_LABELS, type StakeholderId } from "../simulator/alignment";
import type { Heir } from "../simulator/types";

/**
 * A seat in the Decision Room: one of the four stakeholders, or one named heir
 * (`nextGen:<heir id>`, ADR-001 stage 4). The shared `nextGen` seat stays for
 * companies that answer as one next generation. Stored as-is in the
 * `stakeholder` column, so keys, link binding and RLS are unchanged.
 */
export type HeirSeat = `nextGen:${string}`;
export type SeatId = StakeholderId | HeirSeat;

const HEIR_SEAT = /^nextGen:([A-Za-z0-9_-]{1,40})$/;

export const isHeirSeat = (seat: string): seat is HeirSeat => HEIR_SEAT.test(seat);

/** The heir's seat, or null when their id can't be part of a seat key. */
export const heirSeat = (heirId: string): HeirSeat | null => {
  const seat = `nextGen:${heirId}`;
  return isHeirSeat(seat) ? seat : null;
};

export const heirIdOf = (seat: SeatId): string | null => HEIR_SEAT.exec(seat)?.[1] ?? null;

/** The stakeholder a seat speaks for: every heir seat is a Next-gen heir. */
export const stakeholderOf = (seat: SeatId): StakeholderId => (isHeirSeat(seat) ? "nextGen" : seat);

export const seatSchema = z.custom<SeatId>(
  (value) => typeof value === "string" && ((STAKEHOLDER_IDS as string[]).includes(value) || isHeirSeat(value)),
  { message: "Unknown seat" },
);

/** Founder, the next generation (shared seat, then heirs as named), board, lender. */
export function orderSeats(seats: Iterable<SeatId>): SeatId[] {
  const rank = (seat: SeatId) => STAKEHOLDER_IDS.indexOf(stakeholderOf(seat)) * 2 + (isHeirSeat(seat) ? 1 : 0);
  return [...new Set(seats)].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

/** "Founder", "Next-gen heir", or the heir's name ("An heir" if they're no longer in the list). */
export function seatName(seat: SeatId, heirs: readonly Heir[] = []): string {
  if (!isHeirSeat(seat)) return STAKEHOLDER_LABELS[seat];
  const id = heirIdOf(seat);
  return heirs.find((h) => h.id === id)?.name.trim() || "An heir";
}

/** For running text: "the Founder" (or "the founder" with `lower`), but just "Ana" for a named heir. */
export function seatPhrase(seat: SeatId, heirs: readonly Heir[] = [], lower = false): string {
  if (isHeirSeat(seat)) {
    const name = seatName(seat, heirs);
    return name === "An heir" ? (lower ? "an heir" : name) : name;
  }
  const label = STAKEHOLDER_LABELS[seat];
  return `the ${lower ? label.toLowerCase() : label}`;
}
