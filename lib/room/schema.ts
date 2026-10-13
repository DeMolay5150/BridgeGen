import { z } from "zod";
import { STAKEHOLDER_IDS, type StakeholderId } from "../simulator/alignment";
import { TOPIC_IDS } from "./topics";
import type { Answers } from "./types";

export const stakeholderSchema = z.enum(STAKEHOLDER_IDS as [StakeholderId, ...StakeholderId[]]);

const rating = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]);

/** A map of topic → 1–5; unknown topics are rejected, not silently dropped. */
export const answersSchema = z
  .record(z.string(), rating)
  .refine((answers) => Object.keys(answers).every((k) => (TOPIC_IDS as string[]).includes(k)), {
    message: "Unknown topic",
  })
  .transform((answers) => answers as Answers);

export const responseBodySchema = z.object({
  positions: answersSchema,
  predictions: answersSchema,
  submitted: z.boolean(),
});

export const inviteBodySchema = z.object({ stakeholder: stakeholderSchema });

/** Invite tokens are 32 random bytes, base64url-encoded (43 characters). */
export const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

/** Request bodies are tiny; anything bigger is refused before parsing. */
export const MAX_BODY_BYTES = 4_096;
