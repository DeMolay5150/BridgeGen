import type { RoomResponse } from "./types";

export const EMPTY_RESPONSE: RoomResponse = { positions: {}, predictions: {}, submitted: false };

/**
 * Applies an edit to a questionnaire. Changing any answer un-submits it, so
 * gaps are never computed from a half-edited set.
 */
export function applyResponsePatch(current: RoomResponse | undefined, patch: Partial<RoomResponse>): RoomResponse {
  const base = current ?? EMPTY_RESPONSE;
  const editsAnswers = "positions" in patch || "predictions" in patch;
  return {
    positions: { ...base.positions, ...patch.positions },
    predictions: { ...base.predictions, ...patch.predictions },
    submitted: patch.submitted ?? (editsAnswers ? false : base.submitted),
  };
}
