import type { z } from "zod";
import { MAX_BODY_BYTES, answersSchema, stakeholderSchema } from "./schema";
import type { RoomResponses } from "./types";

/** A `room_responses` row as stored. */
export interface ResponseRow {
  stakeholder: unknown;
  positions: unknown;
  predictions: unknown;
  submitted: unknown;
}

export type ParsedBody<T> = { ok: true; data: T } | { ok: false; status: 400 | 413; error: string };

/** Validates a raw request body. Error messages never echo the submitted values. */
export function parseBody<T>(text: string, schema: z.ZodType<T>): ParsedBody<T> {
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
    return { ok: false, status: 413, error: "Request too large" };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, status: 400, error: "Invalid JSON" };
  }
  const parsed = schema.safeParse(raw);
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false, status: 400, error: "Invalid request" };
}

/** Turns stored rows into responses for gap detection, skipping any row that fails validation. */
export function rowsToResponses(rows: ResponseRow[]): RoomResponses {
  const responses: RoomResponses = {};
  for (const row of rows) {
    const stakeholder = stakeholderSchema.safeParse(row.stakeholder);
    const positions = answersSchema.safeParse(row.positions);
    const predictions = answersSchema.safeParse(row.predictions);
    if (!stakeholder.success || !positions.success || !predictions.success || typeof row.submitted !== "boolean") continue;
    responses[stakeholder.data] = { positions: positions.data, predictions: predictions.data, submitted: row.submitted };
  }
  return responses;
}
